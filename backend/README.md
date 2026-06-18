# Cool Cat Kit — backend (FastAPI + PostgreSQL)

Полноценный API + БД для хранения данных пользователей на сервере (не в localStorage).

```
backend/
  app/
    main.py          FastAPI: CORS, статика /media, авто-инициализация БД
    config.py        настройки из .env (+ нормализация URL Render/Heroku)
    database.py      engine + сессии
    models.py        SQLAlchemy-модели (= schema.sql)
    schemas.py       Pydantic-схемы, JSON в camelCase
    security.py      bcrypt + JWT
    deps.py          текущий пользователь/кот по токену
    init_db.py       создать таблицы + сид пород
    routers/         auth, me, notes, reminders, weights, posts, breeds, upload
  schema.sql         чистый PostgreSQL DDL + сид (альтернатива init_db)
  Dockerfile
  docker-compose.yml полный стек (API + Postgres) одной командой
  render.yaml        блюпринт деплоя на Render
  requirements.txt
  .env.example
```

---

## Запуск локально — способ 1: Docker (рекомендую)

Нужен только установленный Docker.

```bash
cd backend
docker compose up --build
```
Поднимется PostgreSQL + API, таблицы создадутся, породы засидятся.

- API: <http://localhost:8000>
- **Swagger (живая документация и тесты): <http://localhost:8000/docs>**
- Проверка: <http://localhost:8000/api/health> → `{"status":"ok"}`

## Запуск локально — способ 2: без Docker

Нужен установленный PostgreSQL.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # пропиши свой DATABASE_URL

createdb coolcatkit             # или psql -f schema.sql, если хочешь голым SQL
uvicorn app.main:app --reload   # таблицы создадутся на старте (AUTO_INIT_DB=1)
```

---

## API (всё под текущий фронт)

Авторизация — заголовок `Authorization: Bearer <token>`. JSON в camelCase.

| Метод | Путь | Назначение |
|------|------|-----------|
| POST | `/api/auth/register` | `{name,email,password,catName?}` → `{token}` (создаёт юзера + кота) |
| POST | `/api/auth/login` | `{email,password}` → `{token}` |
| GET  | `/api/me` | профиль хозяина + паспорт кота |
| PATCH| `/api/me` | обновить имя/паспорт (`catName,breedId,sex,birthday,chip,avatarUrl`) |
| GET/POST | `/api/notes` · PATCH/DELETE `/api/notes/{id}` | медицина/прививки (`repeatMonths` для повтора) |
| GET/POST | `/api/reminders` (`?date=`) · DELETE `/api/reminders/{id}` | события календаря (`category`) |
| GET/POST | `/api/weights` · DELETE `/api/weights/{id}` | вес (одно измерение в день — upsert) |
| GET/POST | `/api/posts` · DELETE `/api/posts/{id}` | лента «История» |
| GET | `/api/breeds` | справочник пород (публичный) |
| POST | `/api/upload` | загрузка картинки (multipart) → `{url}` |
| GET | `/api/health` | проверка живости |

Все записи привязаны к коту текущего пользователя (берётся из токена, **не** из тела запроса).

---

## Деплой

⚠️ **GitHub Pages раздаёт только статику** — бэкенд/БД там не работают.
Схема: фронт на GitHub Pages, бэкенд+БД — на хосте с Python и Postgres.

### Бэкенд → Render (бесплатно, Docker + Postgres)

1. Залить репозиторий на GitHub.
2. На <https://render.com> → **New → Blueprint** → выбрать репозиторий
   (он подхватит `render.yaml` в корне: веб-сервис + база).
3. В переменной `CORS_ORIGINS` указать адрес фронта: `https://ТВОЙ-логин.github.io`.
4. Деплой создаст БД, накатит таблицы и сид при первом старте.
5. Получишь URL вида `https://coolcatkit-api.onrender.com`.

Альтернативы тем же Docker-образом: Railway, Fly.io, любой VPS.

### Фронт → GitHub Pages

Статика (`index.html`, `pages/`, `js/`, `css/`) деплоится на Pages как обычно.
**Но фронт пока работает на localStorage и ещё не ходит в API** — это
следующий шаг (заменить `Store`/`Auth` в `js/app.js` на `fetch` к бэкенду,
прописать базовый URL API и токен). Скажи — сделаем.

---

## Переменные окружения

| Переменная | Зачем |
|---|---|
| `DATABASE_URL` | подключение к Postgres (psycopg3) |
| `JWT_SECRET` | секрет подписи токенов — на проде задать СВОЙ |
| `JWT_EXPIRE_MINUTES` | срок жизни токена (по умолчанию 7 дней) |
| `CORS_ORIGINS` | адрес(а) фронта через запятую |
| `MEDIA_DIR` | папка для загруженных картинок |
| `AUTO_INIT_DB` | `1` — создавать таблицы и сид при старте |

---

## На будущее (hardening)

- **Alembic** вместо `create_all` (управляемые миграции схемы).
- Файлы в **S3/MinIO** вместо локальной `media/` (на Render диск эфемерный).
- Refresh-токены / разлогин со всех устройств.
- Пагинация и rate-limit на ручках.
