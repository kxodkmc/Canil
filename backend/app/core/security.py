import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()

# 仅用于用户不存在时对齐校验耗时，不对应任何真实密码
_TIMING_GUARD_HASH = _hasher.hash("timing-guard-placeholder")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _hasher.verify(password, password_hash)


def verify_password_safely(password: str, password_hash: str | None) -> bool:
    """password_hash 为空（用户不存在）时仍执行一次校验，避免时序侧信道。"""
    if password_hash is None:
        _hasher.verify(password, _TIMING_GUARD_HASH)
        return False
    return _hasher.verify(password, password_hash)


def create_access_token(secret: str, user_id: int, ttl: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(secret: str, token: str) -> dict | None:
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return payload if payload.get("type") == "access" else None


def new_refresh_token() -> tuple[str, str]:
    """返回 (明文 token, sha256 哈希)，哈希入库，明文仅出现在 Cookie 中。"""
    token = secrets.token_urlsafe(32)
    return token, sha256_hex(token)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
