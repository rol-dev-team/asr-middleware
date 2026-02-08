from sqlmodel import SQLModel, Field
from pydantic import EmailStr
import uuid
from datetime import datetime
from typing import Optional


class UserBase(SQLModel):
    username: str = Field(default=None, index=True, max_length=50)
    email: EmailStr = Field(default=None, index=True, max_length=100)
    full_name: str | None = Field(default=None, max_length=255)


class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    is_active: bool = Field(default=False)
    is_superuser: bool = Field(default=False)
    hashed_password: str = Field(default=None, max_length=256)


class UserPublic(UserBase):
    id: uuid.UUID


class UserLogin(SQLModel):
    username: str = Field(default=None, max_length=50)
    password: str = Field(default=None, max_length=256)


class UserCreate(UserBase):
    password: str = Field(default=None, max_length=256)


class TokenResponse(SQLModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(SQLModel):
    refresh_token: str


class TokenBlacklist(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    token: str = Field(index=True, unique=True)


class AudioTranscription(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    filename: str = Field(max_length=255)
    original_filename: str = Field(max_length=255)
    file_size: int
    mime_type: str = Field(max_length=100)
    transcription_text: str = Field(sa_column_kwargs={"nullable": True})
    duration: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")


class AudioTranscriptionCreate(SQLModel):
    pass  # File will be uploaded via multipart form


class AudioTranscriptionPublic(SQLModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    transcription_text: Optional[str]
    duration: Optional[float]
    created_at: datetime


class AudioTranslation(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    audio_transcription_id: uuid.UUID = Field(foreign_key="audiotranscription.id")
    source_text: str  # Banglish text
    translated_text: str  # Pure English text
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    model_used: str = Field(default="gemini-2.5-flash", max_length=100)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AudioTranslationCreate(SQLModel):
    audio_transcription_id: uuid.UUID
    source_text: str


class AudioTranslationPublic(SQLModel):
    id: uuid.UUID
    audio_transcription_id: uuid.UUID
    source_text: str
    translated_text: str
    confidence_score: Optional[float]
    model_used: str
    created_at: datetime


class MeetingAnalysis(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    audio_translation_id: uuid.UUID = Field(foreign_key="audiotranslation.id")
    content_text: str  # The text that was analyzed (from translation)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")
    
    # Analysis components
    summary: str  # Brief summary of the meeting/content
    business_insights: str  # Business-focused analysis
    technical_insights: str  # Technical analysis
    action_items: Optional[str] = None  # Extracted action items
    key_topics: Optional[str] = None  # Main topics discussed
    
    # Optional markdown notes
    notes_markdown: Optional[str] = None  # Full formatted notes in markdown
    
    model_used: str = Field(default="gemini-2.5-flash", max_length=100)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MeetingAnalysisCreate(SQLModel):
    audio_translation_id: uuid.UUID
    generate_markdown: bool = True  # Whether to generate MD notes


class MeetingAnalysisPublic(SQLModel):
    id: uuid.UUID
    audio_translation_id: uuid.UUID
    content_text: str
    summary: str
    business_insights: str
    technical_insights: str
    action_items: Optional[str]
    key_topics: Optional[str]
    notes_markdown: Optional[str]
    model_used: str
    created_at: datetime
