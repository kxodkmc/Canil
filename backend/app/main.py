from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import app.db as db
from app.api.v1 import admin, auth, me, resumes
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.services import admin_service

API_PREFIX = "/api/v1"


class NoCacheStaticFiles(StaticFiles):
    """静态资源禁用启发式缓存：每次协商缓存（ETag 304），保证前端改动即时生效。"""

    async def get_response(self, path: str, scope):
        resp = await super().get_response(path, scope)
        resp.headers["Cache-Control"] = "no-cache"
        return resp


async def _body_limit_middleware(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and int(length) > request.app.state.settings.max_body_bytes:
        return JSONResponse(
            {"code": "payload_too_large", "message": "请求体过大"}, status_code=413
        )
    return await call_next(request)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await db.init(settings.database_url)
        await admin_service.bootstrap_admin(settings)
        yield
        await db.close()

    app = FastAPI(title="Resume Studio API", version="1.0.0", lifespan=lifespan)
    app.state.settings = settings
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    register_error_handlers(app)
    app.middleware("http")(_body_limit_middleware)
    for router in (auth.router, me.router, resumes.router, admin.router):
        app.include_router(router, prefix=API_PREFIX)

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    # 同源托管前端静态文件：API 路由优先，其余路径回落到静态资源
    static_dir = settings.static_dir
    if static_dir and (static_dir := Path(static_dir)).is_dir():
        app.mount("/", NoCacheStaticFiles(directory=static_dir, html=True), name="static")

    return app
