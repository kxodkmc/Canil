from fastapi import APIRouter, Request, Response

from app.api.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.core.config import Settings
from app.core.errors import ApiError
from app.core.ratelimit import SlidingWindowLimiter
from app.schemas.auth import LoginIn, RegisterIn, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = SlidingWindowLimiter()


def _guard_rate(request: Request, email: str) -> None:
    ip = request.client.host if request.client else "?"
    if not limiter.allow(f"{ip}:{email.lower()}", request.app.state.settings.auth_rate_limit):
        raise ApiError(429, "rate_limited", "尝试过于频繁，请稍后再试")


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: RegisterIn, request: Request, response: Response):
    _guard_rate(request, body.email)
    settings: Settings = request.app.state.settings
    user = await auth_service.register(settings, body.email, body.password)
    access, refresh = await auth_service.issue_tokens(settings, user)
    set_auth_cookies(response, settings, access, refresh)
    return user


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, request: Request, response: Response):
    _guard_rate(request, body.email)
    settings: Settings = request.app.state.settings
    user = await auth_service.login(body.email, body.password)
    access, refresh = await auth_service.issue_tokens(settings, user)
    set_auth_cookies(response, settings, access, refresh)
    return user


@router.post("/refresh", response_model=UserOut)
async def refresh(request: Request, response: Response):
    settings: Settings = request.app.state.settings
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise ApiError(401, "unauthorized", "请先登录")
    user, access, new_refresh = await auth_service.rotate_refresh(settings, token)
    set_auth_cookies(response, settings, access, new_refresh)
    return user


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        await auth_service.revoke(token)
    clear_auth_cookies(response)
