"""События календаря (в рамках текущего кота)."""
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_cat
from ..models import Cat, Reminder
from ..schemas import ReminderIn, ReminderOut

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    date: Optional[dt.date] = None,
    cat: Cat = Depends(get_current_cat),
    db: Session = Depends(get_db),
):
    q = db.query(Reminder).filter(Reminder.cat_id == cat.id)
    if date is not None:
        q = q.filter(Reminder.date == date)
    return q.order_by(Reminder.date, Reminder.id).all()


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(data: ReminderIn, cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    rem = Reminder(cat_id=cat.id, **data.model_dump())
    db.add(rem)
    db.commit()
    db.refresh(rem)
    return rem


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: int, cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    rem = db.query(Reminder).filter(Reminder.id == reminder_id, Reminder.cat_id == cat.id).first()
    if not rem:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Событие не найдено")
    db.delete(rem)
    db.commit()
