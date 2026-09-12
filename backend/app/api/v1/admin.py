from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin
from app.models import User
from app.schemas.admin import AllowEmailIn, AllowEmailOut, AdminUserOut, UserPatch
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


@router.get("/allowlist", response_model=list[AllowEmailOut])
async def list_allowlist():
    return await admin_service.list_allowlist()


@router.post("/allowlist", response_model=AllowEmailOut, status_code=201)
async def add_allowed(body: AllowEmailIn, actor: User = Depends(get_current_admin)):
    return await admin_service.add_allowed(body.email, body.note, actor)


@router.delete("/allowlist/{email}", status_code=204)
async def remove_allowed(email: str):
    await admin_service.remove_allowed(email)


@router.get("/users", response_model=list[AdminUserOut])
async def list_users():
    return await admin_service.list_users()


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def patch_user(user_id: int, body: UserPatch, actor: User = Depends(get_current_admin)):
    return await admin_service.patch_user(actor, user_id, body.model_dump(exclude_unset=True))


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, actor: User = Depends(get_current_admin)):
    await admin_service.delete_user(actor, user_id)


@router.get("/users/{user_id}/export")
async def export_user(user_id: int):
    """导出指定账号的全部数据（JSON）：账号信息 + 全部简历（含投递记录）。"""
    return await admin_service.export_user(user_id)


@router.get("/users/{user_id}/applications")
async def export_user_applications(user_id: int, company: str | None = None):
    """导出某个人跨全部简历版本的投递记录列表，可按公司名筛选。"""
    return await admin_service.export_user_applications(user_id, company)
