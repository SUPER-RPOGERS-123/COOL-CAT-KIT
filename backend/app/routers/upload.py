"""Загрузка картинок (аватар кота, фото в «Истории»). В БД хранится только URL."""
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..config import settings
from ..deps import get_current_user
from ..models import User
from ..schemas import UploadOut

router = APIRouter(prefix="/api/upload", tags=["upload"])

ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
MAX_BYTES = 5 * 1024 * 1024  # 5 МБ


@router.post("", response_model=UploadOut)
def upload(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    ext = ALLOWED.get(file.content_type)
    if not ext:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Только картинки: jpeg / png / webp / gif")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Файл больше 5 МБ")
    os.makedirs(settings.media_dir, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(settings.media_dir, name), "wb") as f:
        f.write(data)
    return UploadOut(url=f"/media/{name}")
