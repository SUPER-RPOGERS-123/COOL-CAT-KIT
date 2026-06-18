-- Cool Cat Kit — схема БД (PostgreSQL).
-- Запуск с нуля:
--   createdb coolcatkit
--   psql -d coolcatkit -f backend/schema.sql
-- Скрипт идемпотентный: можно гонять повторно (DROP ... IF EXISTS в начале).

BEGIN;

DROP TABLE IF EXISTS posts, weights, reminders, notes, cats, breeds, users CASCADE;

-- ── аккаунт / хозяин ──────────────────────────────────────────────
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT        NOT NULL UNIQUE,            -- всегда в lower-case
    password_hash TEXT        NOT NULL,                   -- argon2/bcrypt, НЕ пароль
    name          TEXT        NOT NULL,                   -- имя хозяина
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── справочник пород (read-only, сидится ниже) ────────────────────
CREATE TABLE breeds (
    id       BIGINT PRIMARY KEY,                          -- id совпадает с фронтом (js/data.js)
    name     TEXT NOT NULL,
    tagline  TEXT,
    lifespan TEXT,
    photo    TEXT
);

-- ── кот (паспорт) ─────────────────────────────────────────────────
CREATE TABLE cats (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL DEFAULT 'Кот',        -- кличка
    breed_id   BIGINT      REFERENCES breeds(id),         -- NULL = порода не указана
    sex        TEXT        CHECK (sex IN ('m','f')),      -- NULL = не указан
    birthday   DATE,                                      -- возраст считаем на лету
    chip       TEXT,                                      -- микрочип / клеймо
    avatar_url TEXT,                                      -- путь/URL, НЕ base64
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cats_user ON cats(user_id);

-- ── медицина / прививки / заметки ─────────────────────────────────
CREATE TABLE notes (
    id            BIGSERIAL PRIMARY KEY,
    cat_id        BIGINT      NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    kind          TEXT        NOT NULL CHECK (kind IN ('vaccine','med','note')),
    title         TEXT        NOT NULL,
    body          TEXT        NOT NULL DEFAULT '',
    date          DATE,                                   -- NULL = не в календаре
    repeat_months INT         NOT NULL DEFAULT 0          -- повтор прививки: 0/12/36
                  CHECK (repeat_months >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_cat_date ON notes(cat_id, date);

-- ── события календаря ─────────────────────────────────────────────
CREATE TABLE reminders (
    id         BIGSERIAL PRIMARY KEY,
    cat_id     BIGINT      NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    date       DATE        NOT NULL,
    title      TEXT        NOT NULL,
    category   TEXT        NOT NULL DEFAULT 'reminder'
               CHECK (category IN ('reminder','food','vaccine','walk','grooming','vet')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_cat_date ON reminders(cat_id, date);

-- ── трекер веса ───────────────────────────────────────────────────
CREATE TABLE weights (
    id         BIGSERIAL    PRIMARY KEY,
    cat_id     BIGINT       NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    date       DATE         NOT NULL,
    kg         NUMERIC(4,2) NOT NULL CHECK (kg > 0),      -- 4.20, НЕ float
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (cat_id, date)                                 -- одно измерение в день
);

-- ── лента «История кота» ──────────────────────────────────────────
CREATE TABLE posts (
    id         BIGSERIAL PRIMARY KEY,
    cat_id     BIGINT      NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
    text       TEXT        NOT NULL DEFAULT '',
    image_url  TEXT,                                      -- путь/URL картинки, НЕ base64
    date       DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_cat ON posts(cat_id);

-- ── сид справочника пород (id совпадает с фронтом) ────────────────
INSERT INTO breeds (id, name, tagline, lifespan, photo) VALUES
  (1, 'Мейн-кун', 'Ласковый гигант из Мэна', '12–15 лет', 'assets/cats/cat-01.webp'),
  (2, 'Рэгдолл', 'Тряпичная кукла на руках', '12–17 лет', 'assets/cats/cat-02.webp'),
  (3, 'Британская короткошёрстная', 'Плюшевый британец', '12–20 лет', 'assets/cats/cat-03.webp'),
  (4, 'Бенгальская кошка', 'Домашний мини-леопард', '12–16 лет', 'assets/cats/cat-04.webp'),
  (5, 'Шотландская вислоухая', 'Уши-конвертики', '11–15 лет', 'assets/cats/cat-05.webp'),
  (6, 'Сибирская кошка', 'Сибирячка с тройной шубой', '12–18 лет', 'assets/cats/cat-06.webp'),
  (7, 'Персидская кошка', 'Аристократ с приплюснутой мордой', '12–17 лет', 'assets/cats/cat-07.webp'),
  (8, 'Сфинкс', 'Голый и тёплый', '10–15 лет', 'assets/cats/cat-08.webp'),
  (9, 'Абиссинская кошка', 'Неугомонный исследователь', '12–16 лет', 'assets/cats/cat-09.webp'),
  (10, 'Русская голубая', 'Серебро и изумрудные глаза', '15–20 лет', 'assets/cats/cat-10.webp'),
  (11, 'Норвежская лесная', 'Лесная кошка викингов', '13–18 лет', 'assets/cats/cat-11.webp'),
  (12, 'Ориентальная короткошёрстная', 'Большие уши, громкий голос', '12–15 лет', 'assets/cats/cat-12.webp'),
  (13, 'Девон-рекс', 'Кудрявый эльф', '12–16 лет', 'assets/cats/cat-13.webp'),
  (14, 'Экзотическая короткошёрстная', 'Перс в плюшевой версии', '12–15 лет', 'assets/cats/cat-14.webp'),
  (15, 'Священная бирма', 'Белые перчатки и голубые глаза', '12–16 лет', 'assets/cats/cat-15.webp');

COMMIT;
