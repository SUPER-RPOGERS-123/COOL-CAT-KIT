"""Зависимости FastAPI: текущий пользователь и его кот по токену."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import Cat, User
from .security import decode_token

bearer = HTTPBearer(auto_error=True)


def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(cred.credentials)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Недействительный токен")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь не найден")
    return user


def get_current_cat(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Cat:
    """Текущий (единственный на старте) кот пользователя."""
    cat = db.query(Cat).filter(Cat.user_id == user.id).order_by(Cat.id).first()
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "У пользователя нет кота")
    return cat
