"""Справочник пород (публичный, read-only)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Breed
from ..schemas import BreedOut

router = APIRouter(prefix="/api/breeds", tags=["breeds"])


@router.get("", response_model=list[BreedOut])
def list_breeds(db: Session = Depends(get_db)):
    return db.query(Breed).order_by(Breed.id).all()
