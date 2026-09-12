from datetime import datetime, timezone

from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction

from app.core import security
from app.core.config import Settings
from app.core.errors import ApiError, not_found
from app.models import AllowedEmail, RefreshToken, Resume, User


async def bootstrap_admin(settings: Settings) -> None:
    """幂等引导：管理员加入名单并创建账号，已存在则跳过。"""
    if not settings.admin_email or not settings.admin_password:
        return
    email = settings.admin_email.lower()
    if not await AllowedEmail.exists(email=email):
        await AllowedEmail.create(email=email, note="引导管理员", created_by="system")
    if await User.exists(email=email):
        return
    await User.create(
        email=email,
        password_hash=security.hash_password(settings.admin_password),
        is_admin=True,
    )


async def list_allowlist() -> list[AllowedEmail]:
    return await AllowedEmail.all().order_by("email")


async def add_allowed(email: str, note: str, actor: User) -> AllowedEmail:
    try:
        return await AllowedEmail.create(email=email.lower(), note=note, created_by=actor.email)
    except IntegrityError:
        raise ApiError(409, "exists", "邮箱已在允许列表中")


async def remove_allowed(email: str) -> None:
    """移出名单与停用对应用户在同一事务中，保证不会留下可登录的孤儿账号。"""
    async with in_transaction():
        if not await AllowedEmail.filter(email=email.lower()).delete():
            raise not_found("邮箱不在允许列表中")
        await User.filter(email=email.lower()).update(is_active=False)


async def list_users() -> list[User]:
    return await User.all().order_by("id")


async def patch_user(actor: User, user_id: int, patch: dict) -> User:
    target = await User.get_or_none(id=user_id)
    if target is None:
        raise not_found("用户不存在")
    demotes_self = target.id == actor.id and (
        patch.get("is_active") is False or patch.get("is_admin") is False
    )
    if demotes_self:
        raise ApiError(400, "self_demotion", "不能停用或降级自己")
    updates = {k: v for k, v in patch.items() if v is not None}
    if updates:
        await target.update_from_dict(updates).save()
    return target


async def delete_user(actor: User, user_id: int) -> None:
    target = await User.get_or_none(id=user_id)
    if target is None:
        raise not_found("用户不存在")
    if target.id == actor.id:
        raise ApiError(400, "self_delete", "不能删除自己")
    async with in_transaction():
        await RefreshToken.filter(user=target).delete()
        await Resume.filter(user=target).delete()
        # 连同白名单一并移除：被删邮箱不可凭残留许可重新注册
        await AllowedEmail.filter(email=target.email).delete()
        await target.delete()


# ---------- 数据导出 ----------


async def _get_user_or_404(user_id: int) -> User:
    user = await User.get_or_none(id=user_id)
    if user is None:
        raise not_found("用户不存在")
    return user


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


async def export_user(user_id: int) -> dict:
    """导出指定账号的全部数据（不含密码哈希等敏感字段）。"""
    user = await _get_user_or_404(user_id)
    resumes = await Resume.filter(user=user).order_by("created_at")
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": user.id,
            "email": user.email,
            "is_admin": user.is_admin,
            "is_active": user.is_active,
            "created_at": _iso(user.created_at),
            "ui_state": user.ui_state,
        },
        "resumes": [
            {
                "id": r.id,
                "name": r.name,
                "revision": r.revision,
                "data": r.data,
                "style": r.style,
                "applications": r.applications,
                "created_at": _iso(r.created_at),
                "updated_at": _iso(r.updated_at),
            }
            for r in resumes
        ],
    }


async def export_user_applications(user_id: int, company: str | None = None) -> list[dict]:
    """导出某个人跨全部简历版本的投递记录列表；company 可按公司名模糊筛选（不区分大小写）。"""
    user = await _get_user_or_404(user_id)
    resumes = await Resume.filter(user=user).order_by("created_at")
    kw = (company or "").strip().lower()
    rows = []
    for r in resumes:
        for a in r.applications or []:
            if not isinstance(a, dict):
                continue
            if kw and kw not in str(a.get("company") or "").lower():
                continue
            rows.append(
                {
                    "company": a.get("company") or "",
                    "company_url": a.get("companyUrl") or "",
                    "job": a.get("job") or "",
                    "job_url": a.get("url") or "",
                    "date": a.get("date") or "",
                    "note": a.get("note") or "",
                    "resume_id": r.id,
                    "resume_name": r.name,
                }
            )
    rows.sort(key=lambda x: x["date"], reverse=True)
    return rows
