# ТЗ — бэкенд и база данных для Cool Cat Kit

Документ для исполнителя (джуна). Цель — заменить хранение в `localStorage` на
нормальный бэкенд с БД, чтобы данные жили на сервере и синхронизировались между
устройствами. Фронт уже готов (`index.html`, `pages/`, `js/`), его API-вызовы
надо подружить с сервером.

---

## 1. Стек (зафиксирован, не обсуждается)

- **Python 3.11+**, **FastAPI**
- **PostgreSQL** (прод и сервер). Локально для разработки допустим **SQLite** —
  код через SQLAlchemy одинаковый, меняется только строка подключения.
- **SQLAlchemy 2.x** (ORM) + **Alembic** (миграции)
- **Pydantic v2** (схемы запросов/ответов)
- Пароли — **argon2** или **bcrypt** (`passlib`), хранить только хэш.
- Аутентификация — **JWT** (`python-jose`) или серверная сессия с httpOnly-cookie.
- Файлы (аватары, фото в «Истории») — **объектное хранилище** (S3/MinIO) или
  локальная папка `media/`. В БД хранится только URL/путь, не сам файл.

> Не приносить: MongoDB (данные реляционные), хранение картинок в base64 в БД,
> пароли в открытом виде. Это сразу в отказ на ревью.

---

## 2. Модель данных (как сейчас на фронте → как должно стать в БД)

Сейчас фронт хранит (ключи localStorage):
- `cck_users` — словарь `{ email: {name, email, password, catName, avatar} }`
- `cck_session` — текущий email
- `cck_notes_<email>` — медзаписи
- `cck_cal_<email>` — напоминания по дням
- `cck_posts_<email>` — посты «Истории»

Переносим в таблицы. У каждого пользователя — свои записи (внешний ключ `user_id`).

### Схема (DDL, ориентир — PostgreSQL)

```sql
-- пользователи
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,   -- хранить в lower-case
    password_hash TEXT        NOT NULL,
    cat_name      TEXT        NOT NULL DEFAULT 'Кот',
    avatar_url    TEXT,                          -- NULL = дефолтная заглушка
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- медицина / прививки / заметки
CREATE TABLE notes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT        NOT NULL CHECK (kind IN ('vaccine', 'med', 'note')),
    title      TEXT        NOT NULL,
    body       TEXT        NOT NULL DEFAULT '',
    date       DATE,                              -- NULL = не привязана к календарю
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_user_date ON notes(user_id, date);

-- напоминания календаря (то, что заводится прямо в дне)
CREATE TABLE reminders (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       DATE        NOT NULL,
    title      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_user_date ON reminders(user_id, date);

-- лента «История кота»
CREATE TABLE posts (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text       TEXT        NOT NULL DEFAULT '',
    image_url  TEXT,                              -- путь/URL картинки, не base64
    date       DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_user ON posts(user_id);
```

**Породы (`js/data.js`)** — это справочник, одинаковый для всех. Можно оставить
статикой на фронте, можно вынести в read-only таблицу `breeds` и отдавать
`GET /breeds`. На первом этапе — оставить как есть, не приоритет.

---

## 3. API (минимальный контракт под текущий фронт)

Все ответы — JSON. Защищённые ручки требуют токен/сессию. Тело ошибки:
`{ "detail": "текст" }` (фронт уже показывает `err.message`).

### Аутентификация
| Метод | Путь | Назначение |
|------|------|-----------|
| `POST` | `/api/auth/register` | `{name, email, password, catName, avatar?}` → создать юзера, вернуть токен |
| `POST` | `/api/auth/login` | `{email, password}` → токен |
| `POST` | `/api/auth/logout` | завершить сессию |
| `GET`  | `/api/me` | текущий профиль |
| `PATCH`| `/api/me` | сменить `name`, `catName`, `avatar` |

### Записи (всё в контексте текущего юзера — `user_id` берётся из токена, **не из тела**)
| Метод | Путь |
|------|------|
| `GET` / `POST` | `/api/notes` , `DELETE /api/notes/{id}` , `PATCH /api/notes/{id}` (правка даты) |
| `GET` / `POST` | `/api/reminders` (фильтр `?date=`) , `DELETE /api/reminders/{id}` |
| `GET` / `POST` | `/api/posts` , `DELETE /api/posts/{id}` |

### Загрузка файлов
| `POST` | `/api/upload` | `multipart/form-data`, вернуть `{ url }`. Аватар и фото поста заливаются сюда, в записи кладётся уже URL. |

> Важно: на бэке игнорировать любой `user_id`/email, пришедший от клиента.
> Принадлежность определяется **только** по токену. Иначе один юзер прочитает
> чужие данные.

---

## 4. Структура проекта (ориентир)

```
backend/
  app/
    main.py            # FastAPI(), подключение роутеров, CORS
    config.py          # настройки из .env (Pydantic Settings)
    database.py        # engine, SessionLocal, get_db()
    models.py          # SQLAlchemy-модели (таблицы из п.2)
    schemas.py         # Pydantic-схемы запросов/ответов
    security.py        # хэш пароля, выпуск/проверка JWT
    deps.py            # get_current_user
    routers/
      auth.py
      notes.py
      reminders.py
      posts.py
      upload.py
  alembic/             # миграции
  alembic.ini
  requirements.txt
  .env.example
  README.md
```

`.env.example`:
```
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/coolcatkit
# локально можно: DATABASE_URL=sqlite:///./dev.db
JWT_SECRET=change-me
JWT_EXPIRE_MINUTES=10080
MEDIA_DIR=./media
CORS_ORIGINS=http://localhost:8000
```

---

## 5. Порядок работы (по шагам)

1. Поднять каркас FastAPI, ручка `GET /api/health` → `{"status":"ok"}`.
2. Настроить `database.py` и `models.py`. Завести Alembic, сделать **первую
   миграцию** (`alembic revision --autogenerate`, затем `alembic upgrade head`).
   Таблицы создаются **только миграциями**, не `create_all` в проде.
3. Реализовать регистрацию/логин с хэшем пароля и выдачей JWT.
4. `get_current_user` (зависимость), защитить остальные ручки.
5. CRUD для `notes`, `reminders`, `posts` — строго в рамках текущего юзера.
6. Загрузка файлов (`/api/upload`), отдача `media/`.
7. Включить CORS под адрес фронта.
8. Подключить фронт: заменить обращения к `localStorage` (объекты `Store`,
   `Auth` в `js/app.js`) на `fetch` к API. Токен хранить в `localStorage` или
   httpOnly-cookie.

---

## 6. Критерии приёмки

- [ ] Миграции применяются с нуля одной командой (`alembic upgrade head`).
- [ ] Регистрация и логин работают; в БД лежит **хэш**, не пароль.
- [ ] Юзер видит и меняет только свои записи; чужой `user_id` в запросе ничего
      не меняет.
- [ ] Картинки лежат файлами, в БД — только URL.
- [ ] Email уникален и приводится к нижнему регистру.
- [ ] Удаление пользователя удаляет его записи (каскад).
- [ ] Есть `.env.example` и `README.md` с командами запуска.
- [ ] Минимальные тесты на auth и хотя бы один CRUD (`pytest`).

---

## 7. Рекомендации

- **Начать на SQLite, выкатывать на PostgreSQL.** Код через SQLAlchemy не
  меняется, разница только в `DATABASE_URL`. Не тратить день на поднятие
  Postgres ради первого прототипа, но проверить совместимость до релиза.
- **Не хранить картинки в БД.** base64 в колонке раздует таблицу и убьёт
  скорость выборок. Файлы — в `media/`/S3, в БД ссылка.
- **Валидация на сервере обязательна.** `minlength` пароля на фронте — это
  удобство, а не защита. Проверять email, длину пароля, тип файла на бэке.
- **Даты строкой `YYYY-MM-DD`** — фронт уже в этом формате (`fmtDate`,
  `<input type="date">`). В БД — тип `DATE`, в JSON отдавать ISO-строкой.
- **Если команда слабая или сроки горят** — рассмотреть Supabase: тот же
  Postgres, но готовые auth и storage из коробки, меньше своего кода. Минус —
  привязка к их API.
- **Секреты — только в `.env`**, в гит не коммитить. Добавить `.env` в
  `.gitignore`.
