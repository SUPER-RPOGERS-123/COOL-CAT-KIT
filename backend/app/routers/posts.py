"""Лента «История кота» (в рамках текущего кота)."""
import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_cat
from ..models import Cat, Post
from ..schemas import PostIn, PostOut

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("", response_model=list[PostOut])
def list_posts(cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    return db.query(Post).filter(Post.cat_id == cat.id).order_by(Post.id.desc()).all()


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(data: PostIn, cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    if not data.text and not data.image_url:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Добавь текст или фото")
    post = Post(
        cat_id=cat.id,
        text=data.text,
        image_url=data.image_url,
        date=data.date or dt.date.today(),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id, Post.cat_id == cat.id).first()
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пост не найден")
    db.delete(post)
    db.commit()
