"""Трекер веса (в рамках текущего кота). Одно измерение в день — upsert."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_cat
from ..models import Cat, Weight
from ..schemas import WeightIn, WeightOut

router = APIRouter(prefix="/api/weights", tags=["weights"])


@router.get("", response_model=list[WeightOut])
def list_weights(cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    return db.query(Weight).filter(Weight.cat_id == cat.id).order_by(Weight.date).all()


@router.post("", response_model=WeightOut, status_code=status.HTTP_201_CREATED)
def add_weight(data: WeightIn, cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    w = db.query(Weight).filter(Weight.cat_id == cat.id, Weight.date == data.date).first()
    if w:
        w.kg = data.kg  # одно измерение в день — обновляем
    else:
        w = Weight(cat_id=cat.id, date=data.date, kg=data.kg)
        db.add(w)
    db.commit()
    db.refresh(w)
    return w


@router.delete("/{weight_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight(weight_id: int, cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    w = db.query(Weight).filter(Weight.id == weight_id, Weight.cat_id == cat.id).first()
    if not w:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Измерение не найдено")
    db.delete(w)
    db.commit()
