from fastapi import Response

from app.core.config import Settings

ACCESS_COOKIE = "rs_access"
REFRESH_COOKIE = "rs_refresh"
ACCESS_PATH = "/api/v1"
REFRESH_PATH = "/api/v1/auth"


def set_auth_cookies(response: Response, settings: Settings, access: str, refresh: str) -> None:
    common = {"httponly": True, "samesite": "strict", "secure": settings.cookie_secure}
    response.set_cookie(ACCESS_COOKIE, access, max_age=settings.access_ttl, path=ACCESS_PATH, **common)
    response.set_cookie(REFRESH_COOKIE, refresh, max_age=settings.refresh_ttl, path=REFRESH_PATH, **common)


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path=ACCESS_PATH)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH)
