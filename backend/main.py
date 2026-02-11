from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db import Base, engine, SessionLocal
from models import Note

Base.metadata.create_all(bind=engine)

app = FastAPI()



origins = [
    "http://localhost:5173",
    "https://notes-fullstack-one.vercel.app/",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# allow React dev server to call backend

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class NoteUpdate(BaseModel):
    text: str


class NoteCreate(BaseModel):
    text: str

class NoteOut(BaseModel):
    id: int
    text: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@app.get("/api/notes", response_model=list[NoteOut])
def list_notes(db: Session = Depends(get_db)):
    return db.query(Note).order_by(Note.id.desc()).all()

@app.post("/api/notes", response_model=NoteOut)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    note = Note(text=text)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note

@app.delete("/api/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()
    return {"deleted": True, "id": note_id}

@app.put("/api/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: int, payload: NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    note.text = text
    db.commit()
    db.refresh(note)
    return note
