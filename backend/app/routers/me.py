"""Профиль хозяина + паспорт кота."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_cat, get_current_user
from ..models import Cat, User
from ..schemas import CatOut, MeOut, MeUpdateIn

router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me", response_model=MeOut)
def get_me(user: User = Depends(get_current_user), cat: Cat = Depends(get_current_cat)):
    return MeOut(name=user.name, email=user.email, cat=CatOut.model_validate(cat))


@router.patch("/me", response_model=MeOut)
def update_me(
    data: MeUpdateIn,
    user: User = Depends(get_current_user),
    cat: Cat = Depends(get_current_cat),
    db: Session = Depends(get_db),
):
    fields = data.model_dump(exclude_unset=True)  # только присланные поля
    if "name" in fields:
        user.name = fields["name"]
    cat_map = {
        "cat_name": "name", "breed_id": "breed_id", "sex": "sex",
        "birthday": "birthday", "chip": "chip", "avatar_url": "avatar_url",
    }
    for key, attr in cat_map.items():
        if key in fields:
            val = fields[key]
            if attr == "name" and not val:
                val = "Котик"
            setattr(cat, attr, val)
    db.commit()
    db.refresh(user)
    db.refresh(cat)
    return MeOut(name=user.name, email=user.email, cat=CatOut.model_validate(cat))
