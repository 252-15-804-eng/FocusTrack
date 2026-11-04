import os
import re
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form
)

from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel, Field

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Float,
    Text,
    func
)

from sqlalchemy.orm import Session

from jose import jwt, JWTError
from pwdlib import PasswordHash

from database import Base, engine, SessionLocal, get_db


# ==========================================
# CONFIGURATION
# ==========================================

load_dotenv()

app = FastAPI(title="FocusTrack API")

SECRET_KEY = os.getenv("SECRET_KEY")
ADMIN_NAME = os.getenv("ADMIN_NAME", "FocusTrack Admin")
ADMIN_PHONE = os.getenv("ADMIN_PHONE")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

if not SECRET_KEY or SECRET_KEY == "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET":
    raise RuntimeError("Please set a secure SECRET_KEY in your .env file")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

password_hash = PasswordHash.recommended()
security = HTTPBearer(auto_error=False)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "https://focus-track-kappa.vercel.app"
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# DATABASE MODELS
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    identifier = Column(String(150), unique=True, index=True, nullable=False)
    identifier_type = Column(String(20), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user")

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    last_login = Column(DateTime, nullable=True)


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    subject = Column(String(100), nullable=False, default="General")
    duration_seconds = Column(Integer, nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    activity = Column(String(30), default="Study")


class Subject(Base):
    __tablename__ = "user_subjects"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    name = Column(String(100), nullable=False)


class UserGoal(Base):
    __tablename__ = "user_goals"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
        index=True
    )

    study_goal = Column(Float, default=6.0, nullable=False)
    phone_limit = Column(Float, default=3.0, nullable=False)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
        index=True
    )

    theme = Column(String(20), default="dark", nullable=False)


# ==========================================
# NOTES MODEL
# ==========================================

class Note(Base):
    __tablename__ = "user_notes"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False, default="")
    subject = Column(String(100), nullable=True)

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )


# ==========================================
# PDF MODEL
# ==========================================

class PDFDocument(Base):
    __tablename__ = "user_pdfs"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(80), unique=True, nullable=False)
    subject = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=False)

    uploaded_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )


# Create database tables
Base.metadata.create_all(bind=engine)


# ==========================================
# REQUEST MODELS
# ==========================================

class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    identifier: str = Field(min_length=5, max_length=150)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=5, max_length=150)
    password: str = Field(min_length=8, max_length=128)


class StudySessionCreate(BaseModel):
    subject: str = Field(default="General", max_length=100)
    duration_seconds: int = Field(ge=1, le=604800)
    start_time: datetime | None = None
    end_time: datetime | None = None
    activity: str = Field(default="Study", max_length=30)


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class GoalUpdate(BaseModel):
    study_goal: float = Field(ge=0.5, le=24)
    phone_limit: float = Field(ge=0, le=24)


class SettingsUpdate(BaseModel):
    theme: str = Field(pattern="^(dark|light)$")


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(default="", max_length=100000)
    subject: str | None = Field(default=None, max_length=100)


class NoteUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(default="", max_length=100000)
    subject: str | None = Field(default=None, max_length=100)


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def normalize_identifier(value: str):
    value = value.strip()

    if "@" in value:
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise HTTPException(
                status_code=400,
                detail="Invalid email address"
            )

        return value.lower(), "email"

    phone = re.sub(r"[\s-]", "", value)

    if phone.startswith("01") and len(phone) == 11:
        phone = "+88" + phone
    elif phone.startswith("8801") and len(phone) == 13:
        phone = "+" + phone

    if not re.fullmatch(r"\+8801[3-9]\d{8}", phone):
        raise HTTPException(
            status_code=400,
            detail="Invalid Bangladesh phone number"
        )

    return phone, "phone"


def as_utc_naive(value):
    if value is None:
        return None

    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    return value


def user_public_data(user):
    return {
        "id": user.id,
        "name": user.name,
        "identifier": user.identifier,
        "identifier_type": user.identifier_type,
        "role": user.role,
        "created_at": user.created_at,
        "last_login": user.last_login
    }


def session_public_data(item):
    return {
        "id": item.id,
        "user_id": item.user_id,
        "subject": item.subject,
        "duration_seconds": item.duration_seconds,
        "start_time": item.start_time,
        "end_time": item.end_time,
        "activity": item.activity
    }


def subject_public_data(item):
    return {
        "id": item.id,
        "user_id": item.user_id,
        "name": item.name
    }


def goal_public_data(item):
    return {
        "study_goal": item.study_goal,
        "phone_limit": item.phone_limit
    }


def settings_public_data(item):
    return {
        "theme": item.theme
    }


def create_access_token(user_id: int):
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# ==========================================
# AUTHENTICATION
# ==========================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Login required"
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = int(payload.get("sub"))

    except (JWTError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return user


# ==========================================
# ADMIN ACCOUNT CREATION
# ==========================================

@app.on_event("startup")
def create_admin():

    if not ADMIN_PHONE or not ADMIN_PASSWORD:
        print("Admin account not configured in .env")
        return

    db = SessionLocal()

    try:
        identifier, identifier_type = normalize_identifier(ADMIN_PHONE)

        admin = db.query(User).filter(
            User.identifier == identifier
        ).first()

        if not admin:
            admin = User(
                name=ADMIN_NAME,
                identifier=identifier,
                identifier_type=identifier_type,
                hashed_password=password_hash.hash(ADMIN_PASSWORD),
                role="admin"
            )

            db.add(admin)

        else:
            admin.name = ADMIN_NAME
            admin.identifier_type = identifier_type
            admin.role = "admin"

            if not password_hash.verify(
                ADMIN_PASSWORD,
                admin.hashed_password
            ):
                admin.hashed_password = password_hash.hash(
                    ADMIN_PASSWORD
                )

        db.commit()
        print("FocusTrack admin account is ready.")

    finally:
        db.close()
        # ==========================================
# HOME
# ==========================================

@app.get("/")
def home():
    return {
        "message": "FocusTrack API is running!"
    }


# ==========================================
# REGISTER
# ==========================================

@app.post("/auth/register")
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db)
):
    identifier, identifier_type = normalize_identifier(
        data.identifier
    )

    existing_user = db.query(User).filter(
        User.identifier == identifier
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Account already exists"
        )

    user = User(
        name=data.name.strip(),
        identifier=identifier,
        identifier_type=identifier_type,
        hashed_password=password_hash.hash(data.password),
        role="user"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Registration successful",
        "user_id": user.id
    }


# ==========================================
# LOGIN
# ==========================================

@app.post("/auth/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    identifier, _ = normalize_identifier(data.identifier)

    user = db.query(User).filter(
        User.identifier == identifier
    ).first()

    if not user or not password_hash.verify(
        data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid login details"
        )

    user.last_login = datetime.now(timezone.utc).replace(
        tzinfo=None
    )

    db.commit()

    token = create_access_token(user.id)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "identifier": user.identifier,
            "role": user.role
        }
    }


# ==========================================
# CURRENT USER
# ==========================================

@app.get("/auth/me")
def get_me(
    user: User = Depends(get_current_user)
):
    return user_public_data(user)


# ==========================================
# STUDY / PHONE SESSIONS
# ==========================================

@app.post("/sessions")
def create_session(
    data: StudySessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    activity = data.activity.strip().title()

    if activity not in ("Study", "Phone"):
        raise HTTPException(
            status_code=400,
            detail="Activity must be Study or Phone"
        )

    item = StudySession(
        user_id=user.id,
        subject=data.subject.strip() or "General",
        duration_seconds=data.duration_seconds,
        start_time=as_utc_naive(data.start_time),
        end_time=as_utc_naive(data.end_time),
        activity=activity
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return session_public_data(item)


@app.get("/sessions")
def get_sessions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items = (
        db.query(StudySession)
        .filter(StudySession.user_id == user.id)
        .order_by(
            StudySession.end_time.desc(),
            StudySession.id.desc()
        )
        .all()
    )

    return [
        session_public_data(item)
        for item in items
    ]


@app.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(StudySession).filter(
        StudySession.id == session_id,
        StudySession.user_id == user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    db.delete(item)
    db.commit()

    return {
        "message": "Session deleted successfully"
    }


# ==========================================
# USER SUBJECTS
# ==========================================

@app.get("/subjects")
def get_subjects(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subjects = db.query(Subject).filter(
        Subject.user_id == user.id
    ).order_by(Subject.id.asc()).all()

    return [
        subject_public_data(item)
        for item in subjects
    ]


@app.post("/subjects")
def create_subject(
    data: SubjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    name = data.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Subject name cannot be empty"
        )

    existing = db.query(Subject).filter(
        Subject.user_id == user.id,
        func.lower(Subject.name) == name.lower()
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Subject already exists"
        )

    item = Subject(
        user_id=user.id,
        name=name
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return subject_public_data(item)


@app.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Subject not found"
        )

    db.delete(item)
    db.commit()

    return {
        "message": "Subject deleted successfully"
    }


# ==========================================
# USER GOALS
# ==========================================

@app.get("/goals")
def get_goals(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goals = db.query(UserGoal).filter(
        UserGoal.user_id == user.id
    ).first()

    if not goals:
        goals = UserGoal(
            user_id=user.id,
            study_goal=6.0,
            phone_limit=3.0
        )

        db.add(goals)
        db.commit()
        db.refresh(goals)

    return goal_public_data(goals)


@app.put("/goals")
def update_goals(
    data: GoalUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goals = db.query(UserGoal).filter(
        UserGoal.user_id == user.id
    ).first()

    if not goals:
        goals = UserGoal(user_id=user.id)
        db.add(goals)

    goals.study_goal = data.study_goal
    goals.phone_limit = data.phone_limit

    db.commit()
    db.refresh(goals)

    return goal_public_data(goals)


# ==========================================
# USER SETTINGS
# ==========================================

@app.get("/settings")
def get_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings = db.query(UserSettings).filter(
        UserSettings.user_id == user.id
    ).first()

    if not settings:
        settings = UserSettings(
            user_id=user.id,
            theme="dark"
        )

        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings_public_data(settings)


@app.put("/settings")
def update_settings(
    data: SettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings = db.query(UserSettings).filter(
        UserSettings.user_id == user.id
    ).first()

    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)

    settings.theme = data.theme

    db.commit()
    db.refresh(settings)

    return settings_public_data(settings)
    # ==========================================
# ADMIN TEST
# ==========================================

@app.get("/admin/test")
def admin_test(
    admin: User = Depends(require_admin)
):
    return {
        "message": "Welcome, Admin!"
    }


# ==========================================
# ADMIN DASHBOARD STATISTICS
# ==========================================

@app.get("/admin/stats")
def admin_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    today_start = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0
    )

    week_start = today_start - timedelta(
        days=today_start.weekday()
    )

    total_users = db.query(func.count(User.id)).filter(
        User.role == "user"
    ).scalar() or 0

    active_today = db.query(func.count(User.id)).filter(
        User.role == "user",
        User.last_login >= today_start
    ).scalar() or 0

    active_this_week = db.query(func.count(User.id)).filter(
        User.role == "user",
        User.last_login >= week_start
    ).scalar() or 0

    total_study_seconds = db.query(
        func.coalesce(
            func.sum(StudySession.duration_seconds),
            0
        )
    ).filter(
        StudySession.activity == "Study"
    ).scalar() or 0

    return {
        "total_users": total_users,
        "active_today": active_today,
        "active_this_week": active_this_week,
        "total_study_seconds": int(total_study_seconds)
    }


# ==========================================
# ADMIN: ALL USERS
# ==========================================

@app.get("/admin/users")
def admin_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).filter(
        User.role == "user"
    ).order_by(User.created_at.desc()).all()

    result = []

    for user in users:

        study_seconds = db.query(
            func.coalesce(
                func.sum(StudySession.duration_seconds),
                0
            )
        ).filter(
            StudySession.user_id == user.id,
            StudySession.activity == "Study"
        ).scalar() or 0

        session_count = db.query(
            func.count(StudySession.id)
        ).filter(
            StudySession.user_id == user.id
        ).scalar() or 0

        result.append({
            **user_public_data(user),
            "total_study_seconds": int(study_seconds),
            "total_sessions": int(session_count)
        })

    return result


# ==========================================
# ADMIN: INDIVIDUAL USER SESSIONS
# ==========================================

@app.get("/admin/users/{user_id}/sessions")
def admin_user_sessions(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(
        User.id == user_id,
        User.role == "user"
    ).first()

    if not target:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    items = db.query(StudySession).filter(
        StudySession.user_id == user_id
    ).order_by(
        StudySession.end_time.desc(),
        StudySession.id.desc()
    ).all()

    return {
        "user": user_public_data(target),
        "sessions": [
            session_public_data(item)
            for item in items
        ]
    }


# ==========================================
# NOTES HELPERS
# ==========================================

def note_public_data(item):
    return {
        "id": item.id,
        "title": item.title,
        "content": item.content,
        "subject": item.subject,
        "created_at": item.created_at,
        "updated_at": item.updated_at
    }


# ==========================================
# CREATE NOTE
# ==========================================

@app.post("/notes")
def create_note(
    data: NoteCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    title = data.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Note title cannot be empty"
        )

    item = Note(
        user_id=user.id,
        title=title,
        content=data.content,
        subject=data.subject.strip() if data.subject else None
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return note_public_data(item)


# ==========================================
# GET ALL NOTES
# ==========================================

@app.get("/notes")
def get_notes(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notes = db.query(Note).filter(
        Note.user_id == user.id
    ).order_by(
        Note.updated_at.desc(),
        Note.id.desc()
    ).all()

    return [
        note_public_data(item)
        for item in notes
    ]


# ==========================================
# GET SINGLE NOTE
# ==========================================

@app.get("/notes/{note_id}")
def get_note(
    note_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()

    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found"
        )

    return note_public_data(note)


# ==========================================
# UPDATE NOTE
# ==========================================

@app.put("/notes/{note_id}")
def update_note(
    note_id: int,
    data: NoteUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()

    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found"
        )

    title = data.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Note title cannot be empty"
        )

    note.title = title
    note.content = data.content
    note.subject = data.subject.strip() if data.subject else None

    db.commit()
    db.refresh(note)

    return note_public_data(note)


# ==========================================
# DELETE NOTE
# ==========================================

@app.delete("/notes/{note_id}")
def delete_note(
    note_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.user_id == user.id
    ).first()

    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found"
        )

    db.delete(note)
    db.commit()

    return {
        "message": "Note deleted successfully"
    }


# ==========================================
# PDF STORAGE CONFIGURATION
# ==========================================

UPLOAD_DIR = Path("/tmp/uploads")
UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)

MAX_PDF_SIZE = 10 * 1024 * 1024  # 10 MB


# ==========================================
# PDF PUBLIC DATA
# ==========================================

def pdf_public_data(item):
    return {
        "id": item.id,
        "filename": item.original_filename,
        "subject": item.subject,
        "file_size": item.file_size,
        "uploaded_at": item.uploaded_at
    }


# ==========================================
# UPLOAD PDF
# ==========================================

@app.post("/pdfs")
async def upload_pdf(
    file: UploadFile = File(...),
    subject: str = Form(default=""),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    original_name = Path(file.filename or "").name

    if not original_name.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )

    if file.content_type not in (
        "application/pdf",
        "application/octet-stream"
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid PDF content type"
        )

    content = await file.read(MAX_PDF_SIZE + 1)

    if len(content) > MAX_PDF_SIZE:
        raise HTTPException(
            status_code=413,
            detail="PDF must be 10 MB or smaller"
        )

    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid PDF file"
        )

    stored_name = f"{uuid.uuid4().hex}.pdf"
    file_path = UPLOAD_DIR / stored_name

    try:
        file_path.write_bytes(content)

        item = PDFDocument(
            user_id=user.id,
            original_filename=original_name[:255],
            stored_filename=stored_name,
            subject=subject.strip()[:100] or None,
            file_size=len(content)
        )

        db.add(item)
        db.commit()
        db.refresh(item)

        return pdf_public_data(item)

    except Exception:
        db.rollback()

        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="PDF upload failed"
        )

    finally:
        await file.close()


# ==========================================
# GET ALL PDFS
# ==========================================

@app.get("/pdfs")
def get_pdfs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    items = db.query(PDFDocument).filter(
        PDFDocument.user_id == user.id
    ).order_by(
        PDFDocument.uploaded_at.desc()
    ).all()

    return [
        pdf_public_data(item)
        for item in items
    ]


# ==========================================
# VIEW PDF
# ==========================================

@app.get("/pdfs/{pdf_id}/view")
def view_pdf(
    pdf_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(PDFDocument).filter(
        PDFDocument.id == pdf_id,
        PDFDocument.user_id == user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="PDF not found"
        )

    file_path = UPLOAD_DIR / item.stored_filename

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="PDF file is missing"
        )

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline"
        }
    )


# ==========================================
# DOWNLOAD PDF
# ==========================================

@app.get("/pdfs/{pdf_id}/download")
def download_pdf(
    pdf_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(PDFDocument).filter(
        PDFDocument.id == pdf_id,
        PDFDocument.user_id == user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="PDF not found"
        )

    file_path = UPLOAD_DIR / item.stored_filename

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="PDF file is missing"
        )

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=item.original_filename
    )


# ==========================================
# DELETE PDF
# ==========================================

@app.delete("/pdfs/{pdf_id}")
def delete_pdf(
    pdf_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(PDFDocument).filter(
        PDFDocument.id == pdf_id,
        PDFDocument.user_id == user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="PDF not found"
        )

    file_path = UPLOAD_DIR / item.stored_filename

    db.delete(item)
    db.commit()

    if file_path.is_file():
        file_path.unlink()

    return {
        "message": "PDF deleted successfully"
    }