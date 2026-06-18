"""Медицина / прививки / заметки (в рамках текущего кота)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_cat
from ..models import Cat, Note
from ..schemas import NoteIn, NoteOut

router = APIRouter(prefix="/api/notes", tags=["notes"])


def _own(note_id: int, cat: Cat, db: Session) -> Note:
    note = db.query(Note).filter(Note.id == note_id, Note.cat_id == cat.id).first()
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Заметка не найдена")
    return note


@router.get("", response_model=list[NoteOut])
def list_notes(cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    return db.query(Note).filter(Note.cat_id == cat.id).order_by(Note.id.desc()).all()


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(data: NoteIn, cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    note = Note(cat_id=cat.id, **data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=NoteOut)
def update_note(note_id: int, data: NoteIn, cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    note = _own(note_id, cat, db)
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(note, key, val)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, cat: Cat = Depends(get_current_cat), db: Session = Depends(get_db)):
    db.delete(_own(note_id, cat, db))
    db.commit()
