"""Подключение к БД: engine + сессии."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .config import settings

# pool_pre_ping — проверять коннект перед запросом (на хостинге простаивающие
# соединения к БД рвутся; иначе после простоя ловим «server closed the connection»)
engine = create_engine(
    settings.database_url, future=True, echo=False,
    pool_pre_ping=True, pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """Зависимость для FastAPI: одна сессия на запрос."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
