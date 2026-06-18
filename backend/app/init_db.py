"""Создать таблицы из моделей и засидить породы.

Альтернатива `psql -f schema.sql` — то же самое, но средствами Python.
Запуск:  python -m app.init_db   (из папки backend/)
"""
from .database import engine, SessionLocal
from .models import Base, Breed

# справочник пород: id совпадает с фронтом (js/data.js)
BREEDS = [
    (1, "Мейн-кун", "Ласковый гигант из Мэна", "12–15 лет", "assets/cats/cat-01.webp"),
    (2, "Рэгдолл", "Тряпичная кукла на руках", "12–17 лет", "assets/cats/cat-02.webp"),
    (3, "Британская короткошёрстная", "Плюшевый британец", "12–20 лет", "assets/cats/cat-03.webp"),
    (4, "Бенгальская кошка", "Домашний мини-леопард", "12–16 лет", "assets/cats/cat-04.webp"),
    (5, "Шотландская вислоухая", "Уши-конвертики", "11–15 лет", "assets/cats/cat-05.webp"),
    (6, "Сибирская кошка", "Сибирячка с тройной шубой", "12–18 лет", "assets/cats/cat-06.webp"),
    (7, "Персидская кошка", "Аристократ с приплюснутой мордой", "12–17 лет", "assets/cats/cat-07.webp"),
    (8, "Сфинкс", "Голый и тёплый", "10–15 лет", "assets/cats/cat-08.webp"),
    (9, "Абиссинская кошка", "Неугомонный исследователь", "12–16 лет", "assets/cats/cat-09.webp"),
    (10, "Русская голубая", "Серебро и изумрудные глаза", "15–20 лет", "assets/cats/cat-10.webp"),
    (11, "Норвежская лесная", "Лесная кошка викингов", "13–18 лет", "assets/cats/cat-11.webp"),
    (12, "Ориентальная короткошёрстная", "Большие уши, громкий голос", "12–15 лет", "assets/cats/cat-12.webp"),
    (13, "Девон-рекс", "Кудрявый эльф", "12–16 лет", "assets/cats/cat-13.webp"),
    (14, "Экзотическая короткошёрстная", "Перс в плюшевой версии", "12–15 лет", "assets/cats/cat-14.webp"),
    (15, "Священная бирма", "Белые перчатки и голубые глаза", "12–16 лет", "assets/cats/cat-15.webp"),
]


def main() -> None:
    Base.metadata.create_all(engine)
    print("Таблицы созданы.")

    with SessionLocal() as db:
        if db.query(Breed).count() == 0:
            db.add_all(
                Breed(id=i, name=n, tagline=t, lifespan=l, photo=p)
                for (i, n, t, l, p) in BREEDS
            )
            db.commit()
            print(f"Засижено пород: {len(BREEDS)}.")
        else:
            print("Породы уже есть, сид пропущен.")


if __name__ == "__main__":
    main()
