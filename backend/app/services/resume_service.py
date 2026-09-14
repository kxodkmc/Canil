from datetime import datetime, timezone

from app.core.errors import ApiError, not_found
from app.models import Resume, User
from app.schemas.resume import ResumeCreate, ResumeUpdate


async def list_for(user: User) -> list[Resume]:
    return await Resume.filter(user=user).order_by("created_at")


async def get(user: User, resume_id: int) -> Resume:
    resume = await Resume.get_or_none(user=user, id=resume_id)
    if resume is None:
        raise not_found("简历不存在")
    return resume


async def create(user: User, payload: ResumeCreate) -> Resume:
    return await Resume.create(user=user, revision=1, **payload.model_dump())


async def update(user: User, resume_id: int, payload: ResumeUpdate) -> Resume:
    """条件更新（WHERE revision=?）天然原子；影响 0 行即为版本冲突或不存在。"""
    rows = await Resume.filter(user=user, id=resume_id, revision=payload.revision).update(
        name=payload.name,
        data=payload.data,
        style=payload.style,
        applications=payload.applications,
        revision=payload.revision + 1,
        updated_at=datetime.now(timezone.utc),
    )
    if rows == 0:
        current = await Resume.get_or_none(user=user, id=resume_id)
        if current is None:
            raise not_found("简历不存在")
        raise ApiError(
            409,
            "revision_conflict",
            "简历已被其他端修改",
            detail={"revision": current.revision},
        )
    return await get(user, resume_id)


async def delete(user: User, resume_id: int) -> None:
    if not await Resume.filter(user=user, id=resume_id).delete():
        raise not_found("简历不存在")
