"""SQLAlchemy 2.0 модели — один-в-один со схемой schema.sql.

Используются и для API, и для авто-создания таблиц (см. init_db.py).
"""
from __future__ import annotations

import datetime as dt
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)  # lower-case
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)       # argon2/bcrypt
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cats: Mapped[list["Cat"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Breed(Base):
    __tablename__ = "breeds"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)  # совпадает с фронтом
    name: Mapped[str] = mapped_column(Text, nullable=False)
    tagline: Mapped[str | None] = mapped_column(Text)
    lifespan: Mapped[str | None] = mapped_column(Text)
    photo: Mapped[str | None] = mapped_column(Text)


class Cat(Base):
    __tablename__ = "cats"
    __table_args__ = (CheckConstraint("sex IN ('m','f')", name="cats_sex_check"),)

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False, default="Котик")
    breed_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("breeds.id"))
    sex: Mapped[str | None] = mapped_column(Text)        # 'm' | 'f' | NULL
    birthday: Mapped[dt.date | None] = mapped_column(Date)
    chip: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="cats")
    breed: Mapped["Breed | None"] = relationship()
    notes: Mapped[list["Note"]] = relationship(
        back_populates="cat", cascade="all, delete-orphan"
    )
    reminders: Mapped[list["Reminder"]] = relationship(
        back_populates="cat", cascade="all, delete-orphan"
    )
    weights: Mapped[list["Weight"]] = relationship(
        back_populates="cat", cascade="all, delete-orphan"
    )
    posts: Mapped[list["Post"]] = relationship(
        back_populates="cat", cascade="all, delete-orphan"
    )


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        CheckConstraint("kind IN ('vaccine','med','note')", name="notes_kind_check"),
        CheckConstraint("repeat_months >= 0", name="notes_repeat_check"),
    )

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    cat_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("cats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)          # vaccine | med | note
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    date: Mapped[dt.date | None] = mapped_column(Date)               # NULL = не в календаре
    repeat_months: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0/12/36
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cat: Mapped["Cat"] = relationship(back_populates="notes")


class Reminder(Base):
    __tablename__ = "reminders"
    __table_args__ = (
        CheckConstraint(
            "category IN ('reminder','food','vaccine','walk','grooming','vet')",
            name="reminders_category_check",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    cat_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("cats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False, default="reminder")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cat: Mapped["Cat"] = relationship(back_populates="reminders")


class Weight(Base):
    __tablename__ = "weights"
    __table_args__ = (
        UniqueConstraint("cat_id", "date", name="weights_cat_date_unique"),
        CheckConstraint("kg > 0", name="weights_kg_check"),
    )

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    cat_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("cats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    kg: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cat: Mapped["Cat"] = relationship(back_populates="weights")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    cat_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("cats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_url: Mapped[str | None] = mapped_column(Text)   # путь/URL, не base64
    date: Mapped[dt.date] = mapped_column(Date, server_default=func.current_date(), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cat: Mapped["Cat"] = relationship(back_populates="posts")
