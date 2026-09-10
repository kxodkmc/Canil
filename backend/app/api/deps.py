from fastapi import Depends, Request

from app.core import security
from app.core.errors import ApiError
from app.models import User


async def get_current_user(request: Request) -> User:
    """每个请求都查库校验 is_active，管理员停用账号即刻生效，无需等 token 过期。"""
    token = request.cookies.get("rs_access")
    payload = (
        security.decode_access_token(request.app.state.settings.jwt_secret, token)
        if token
        else None
    )
    if payload is None:
        raise ApiError(401, "unauthorized", "请先登录")
    user = await User.get_or_none(id=int(payload["sub"]), is_active=True)
    if user is None:
        raise ApiError(401, "unauthorized", "账号不存在或已停用")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise ApiError(403, "forbidden", "需要管理员权限")
    return user
