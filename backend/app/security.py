"""Хэш пароля (bcrypt) и JWT-токены."""
import datetime as dt

import bcrypt
import jwt

from .config import settings

_ALG = "HS256"


def hash_password(password: str) -> str:
    # bcrypt работает максимум с 72 байтами — обрезаем во избежание ошибки
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode())
    except (ValueError, TypeError):
        return False


def create_token(user_id: int) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + dt.timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALG)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[_ALG])
