from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """所有配置集中在环境变量（前缀 RS_）或 .env 中，禁止硬编码。"""

    model_config = SettingsConfigDict(env_prefix="RS_", env_file=".env")

    database_url: str = "sqlite://db.sqlite3"
    jwt_secret: str
    access_ttl: int = 900
    refresh_ttl: int = 14 * 86400
    cookie_secure: bool = False

    admin_email: str = ""
    admin_password: str = ""

    auth_rate_limit: int = 20
    max_body_bytes: int = 2 * 1024 * 1024
    cors_origins: str = ""
    static_dir: str = "../resume-studio"


@lru_cache
def get_settings() -> Settings:
    return Settings()
