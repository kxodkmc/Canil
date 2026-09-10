from tortoise import Tortoise

MODELS = ["app.models"]


async def init(database_url: str) -> None:
    # _enable_global_fallback：uvicorn 的 lifespan 与请求分属不同任务，
    # 需启用全局回退使请求任务可见（Tortoise 1.x 为 FastAPI 场景设计的开关）
    ctx = await Tortoise.init(
        db_url=database_url, modules={"models": MODELS}, _enable_global_fallback=True
    )
    await ctx.generate_schemas(safe=True)
    if database_url.startswith("sqlite"):
        conn = Tortoise.get_connection("default")
        await conn.execute_script("PRAGMA journal_mode=WAL;")


async def close() -> None:
    await Tortoise.close_connections()
