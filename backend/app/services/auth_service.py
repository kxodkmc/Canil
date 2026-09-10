from datetime import datetime, timedelta, timezone

from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction

from app.core import security
from app.core.config import Settings
from app.core.errors import ApiError
from app.models import AllowedEmail, RefreshToken, User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def register(settings: Settings, email: str, password: str) -> User:
    email = email.lower()
    if not await AllowedEmail.exists(email=email):
        raise ApiError(403, "not_allowed", "该邮箱未在允许列表中")
    try:
        return await User.create(
            email=email, password_hash=security.hash_password(password)
        )
    except IntegrityError:
        raise ApiError(409, "email_taken", "该邮箱已注册")


async def login(email: str, password: str) -> User:
    user = await User.get_or_none(email=email.lower())
    if not user or not security.verify_password_safely(password, user.password_hash):
        raise ApiError(401, "bad_credentials", "邮箱或密码错误")
    if not user.is_active:
        raise ApiError(403, "inactive", "账号已停用，请联系管理员")
    return user


async def issue_tokens(settings: Settings, user: User) -> tuple[str, str]:
    access = security.create_access_token(settings.jwt_secret, user.id, settings.access_ttl)
    refresh, token_hash = security.new_refresh_token()
    await RefreshToken.create(
        user=user,
        token_hash=token_hash,
        expires_at=_utcnow() + timedelta(seconds=settings.refresh_ttl),
    )
    return access, refresh


async def rotate_refresh(settings: Settings, token: str) -> tuple[User, str, str]:
    token_hash = security.sha256_hex(token)
    rt = await RefreshToken.filter(token_hash=token_hash).select_related("user").first()
    now = _utcnow()
    if rt is not None and rt.revoked_at is not None:
        # 旧 token 被重放：撤销该用户全部存活 token（独立提交，不随异常回滚）
        await RefreshToken.filter(user=rt.user, revoked_at__isnull=True).update(revoked_at=now)
        raise ApiError(401, "invalid_refresh", "登录已失效，请重新登录")
    if rt is None or rt.expires_at < now or not rt.user.is_active:
        raise ApiError(401, "invalid_refresh", "登录已失效，请重新登录")
    async with in_transaction():
        # 条件更新保证并发下同一条 token 只能被旋转一次
        if not await RefreshToken.filter(id=rt.id, revoked_at__isnull=True).update(revoked_at=now):
            raise ApiError(401, "invalid_refresh", "登录已失效，请重新登录")
        access = security.create_access_token(settings.jwt_secret, rt.user.id, settings.access_ttl)
        refresh, new_hash = security.new_refresh_token()
        await RefreshToken.create(
            user=rt.user,
            token_hash=new_hash,
            expires_at=now + timedelta(seconds=settings.refresh_ttl),
        )
        return rt.user, access, refresh


async def revoke(token: str) -> None:
    await RefreshToken.filter(
        token_hash=security.sha256_hex(token), revoked_at__isnull=True
    ).update(revoked_at=_utcnow())
