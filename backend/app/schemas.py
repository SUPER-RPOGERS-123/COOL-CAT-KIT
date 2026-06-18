"""Pydantic-схемы запросов/ответов. JSON отдаётся в camelCase."""
from __future__ import annotations

import datetime as dt
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel


class Schema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )


# ── auth ──────────────────────────────────────────────
class RegisterIn(Schema):
    name: str
    email: EmailStr
    password: str = Field(min_length=4)
    cat_name: Optional[str] = "Кот"


class LoginIn(Schema):
    email: EmailStr
    password: str


class TokenOut(Schema):
    token: str


# ── профиль / паспорт кота ────────────────────────────
class CatOut(Schema):
    id: int
    name: str
    breed_id: Optional[int] = None
    sex: Optional[Literal["m", "f"]] = None
    birthday: Optional[dt.date] = None
    chip: Optional[str] = None
    avatar_url: Optional[str] = None


class MeOut(Schema):
    name: str
    email: EmailStr
    cat: CatOut


class MeUpdateIn(Schema):
    name: Optional[str] = None
    cat_name: Optional[str] = None
    breed_id: Optional[int] = None
    sex: Optional[Literal["m", "f"]] = None
    birthday: Optional[dt.date] = None
    chip: Optional[str] = None
    avatar_url: Optional[str] = None


# ── медзаметки ────────────────────────────────────────
class NoteIn(Schema):
    kind: Literal["vaccine", "med", "note"]
    title: str
    body: str = ""
    date: Optional[dt.date] = None
    repeat_months: int = 0


class NoteOut(NoteIn):
    id: int


# ── события календаря ─────────────────────────────────
class ReminderIn(Schema):
    date: dt.date
    title: str
    category: Literal["reminder", "food", "vaccine", "walk", "grooming", "vet"] = "reminder"


class ReminderOut(ReminderIn):
    id: int


# ── вес ───────────────────────────────────────────────
class WeightIn(Schema):
    date: dt.date
    kg: float = Field(gt=0)


class WeightOut(WeightIn):
    id: int


# ── история ───────────────────────────────────────────
class PostIn(Schema):
    text: str = ""
    image_url: Optional[str] = None
    date: Optional[dt.date] = None


class PostOut(Schema):
    id: int
    text: str
    image_url: Optional[str] = None
    date: dt.date


# ── справочник пород ──────────────────────────────────
class BreedOut(Schema):
    id: int
    name: str
    tagline: Optional[str] = None
    lifespan: Optional[str] = None
    photo: Optional[str] = None


class UploadOut(Schema):
    url: str
