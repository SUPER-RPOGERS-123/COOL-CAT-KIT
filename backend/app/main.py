"""Cool Cat Kit API — точка входа FastAPI."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import SessionLocal, engine
from .init_db import BREEDS as BREED_SEED
from .models import Base, Breed
from .routers import auth, breeds, me, notes, posts, reminders, upload, weights


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.auto_init_db:
        Base.metadata.create_all(engine)
        with SessionLocal() as db:
            if db.query(Breed).count() == 0:
                db.add_all(
                    Breed(id=i, name=n, tagline=t, lifespan=l, photo=p)
                    for (i, n, t, l, p) in BREED_SEED
                )
                db.commit()
    yield


# каталог для загрузок должен существовать к моменту монтирования статики
os.makedirs(settings.media_dir, exist_ok=True)

app = FastAPI(title="Cool Cat Kit API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=False,          # авторизация по Bearer-токену, не по cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")

for module in (auth, me, notes, reminders, weights, posts, breeds, upload):
    app.include_router(module.router)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
