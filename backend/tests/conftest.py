import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app

ADMIN_EMAIL = "admin@test.dev"
ADMIN_PASSWORD = "admin-secret-1"
PASSWORD = "user-secret-1"
USER_EMAIL = "user@test.dev"


def make_settings(tmp_path) -> Settings:
    return Settings(
        database_url=f"sqlite://{tmp_path / 'test.sqlite3'}",
        jwt_secret="test-secret-0123456789abcdef-0123456789abcdef",
        admin_email=ADMIN_EMAIL,
        admin_password=ADMIN_PASSWORD,
        auth_rate_limit=0,
    )


@pytest_asyncio.fixture
async def app(tmp_path):
    app = create_app(make_settings(tmp_path))
    async with app.router.lifespan_context(app):
        yield app


def _client(app) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest_asyncio.fixture
async def client(app):
    async with _client(app) as c:
        yield c


@pytest_asyncio.fixture
async def admin_client(app):
    async with _client(app) as c:
        await c.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        yield c


@pytest_asyncio.fixture
async def user_client(app):
    """独立于 admin_client 的普通用户客户端，cookie 互不干扰。"""
    async with _client(app) as c:
        await c.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        await c.post("/api/v1/admin/allowlist", json={"email": USER_EMAIL})
        await c.post("/api/v1/auth/register", json={"email": USER_EMAIL, "password": PASSWORD})
        c.cookies.clear()
        r = await c.post("/api/v1/auth/login", json={"email": USER_EMAIL, "password": PASSWORD})
        assert r.status_code == 200
        yield c
