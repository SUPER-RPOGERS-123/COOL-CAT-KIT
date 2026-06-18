"""Настройки из переменных окружения (.env)."""
import os

from dotenv import load_dotenv

load_dotenv()  # читает backend/.env, если есть


def _normalize_db_url(url: str) -> str:
    # хостинги (Render/Heroku) отдают postgres:// — приводим к драйверу psycopg3
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


class Settings:
    # PostgreSQL (psycopg3)
    database_url: str = _normalize_db_url(
        os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://postgres:postgres@localhost:5432/coolcatkit",
        )
    )
    # JWT
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 дней
    # CORS: список origin фронта через запятую, либо "*" для разработки
    cors_origins: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
    ]
    # папка для загруженных файлов (аватары, фото истории)
    media_dir: str = os.getenv("MEDIA_DIR", "./media")
    # автосоздание таблиц + сид пород при старте (удобно на dev/demo)
    auto_init_db: bool = os.getenv("AUTO_INIT_DB", "1") == "1"


settings = Settings()
