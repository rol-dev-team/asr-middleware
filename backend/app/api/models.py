from sqlmodel import SQLModel, Field
from pydantic import EmailStr
import uuid
from datetime import datetime
from typing import Any, Optional


class UserBase(SQLModel):
    username: str = Field(default=None, index=True, max_length=50)
    email: EmailStr = Field(default=None, index=True, max_length=100)
    full_name: str | None = Field(default=None, max_length=255)


class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    is_active: bool = Field(default=False)
    is_superuser: bool = Field(default=False)
    hashed_password: str = Field(default=None, max_length=256)


class UserAdminDisplay(UserBase):
    id: uuid.UUID
    is_active: bool
    is_superuser: bool


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
    task_id: Optional[str] = Field(default=None, index=True, max_length=255)
    filename: str = Field(max_length=255)
    original_filename: str = Field(max_length=255)
    file_size: int
    mime_type: str = Field(max_length=100)
    transcription_text: str = Field(sa_column_kwargs={"nullable": True})
    duration: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")


class AudioTranscriptionCreate(SQLModel):
    task_id: Optional[str] = Field(default=None, max_length=255)
    pass


class AudioTranscriptionPublic(SQLModel):
    id: uuid.UUID
    task_id: Optional[str]
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    transcription_text: Optional[str]
    duration: Optional[float]
    created_at: datetime


class AudioTranslation(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    task_id: Optional[str] = Field(default=None, index=True, max_length=255)
    audio_transcription_id: uuid.UUID = Field(foreign_key="audiotranscription.id")
    source_text: str  # Banglish text
    translated_text: str  # Pure English text
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    model_used: str = Field(default="gemini-2.5-flash", max_length=100)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AudioTranslationCreate(SQLModel):
    task_id: Optional[str] = Field(default=None, max_length=255)
    audio_transcription_id: uuid.UUID
    # source_text: str


class AudioTranslationPublic(SQLModel):
    id: uuid.UUID
    task_id: Optional[str]
    audio_transcription_id: uuid.UUID
    source_text: str
    translated_text: str
    confidence_score: Optional[float]
    model_used: str
    created_at: datetime


class MeetingAnalysis(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    audio_translation_id: uuid.UUID = Field(foreign_key="audiotranslation.id")
    task_id: Optional[str] = Field(default=None, index=True, max_length=255)
    meeting_title: Optional[str] = Field(default=None, max_length=255)
    content_text: Optional[str] = None
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id")
    pdf_path: Optional[str] = Field(default=None, max_length=512)
    
    # Analysis components
    summary: Optional[str] = None  # Brief summary of the meeting/content
    business_insights: Optional[str] = None  # Business-focused analysis
    technical_insights: Optional[str] = None  # Technical analysis
    action_items: Optional[str] = None  # Extracted action items
    key_topics: Optional[str] = None  # Main topics discussed
    
    # Optional markdown notes
    notes_markdown: Optional[str] = None  # Full formatted notes in markdown
    
    model_used: str = Field(default="gemini-2.5-flash", max_length=100)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MeetingAnalysisCreate(SQLModel):
    audio_translation_id: uuid.UUID
    task_id: Optional[str] = Field(default=None, max_length=255)
    meeting_title: Optional[str] = Field(default=None, max_length=255)
    generate_markdown: bool = True  # Whether to generate MD notes


class MeetingAnalysisPublic(SQLModel):
    id: uuid.UUID
    task_id: Optional[str] = Field(default=None)
    meeting_title: Optional[str] = None
    audio_translation_id: uuid.UUID
    content_text: Optional[str]
    summary: Optional[str]
    business_insights: Optional[str]
    technical_insights: Optional[str]
    action_items: Optional[str]
    key_topics: Optional[str]
    notes_markdown: Optional[str]
    pdf_path: Optional[str] = None
    pdf_url: Optional[str] = None
    model_used: str
    created_at: datetime


class FullPipeline(SQLModel):
    task_id: str
    transcription_id: uuid.UUID
    translation_id: uuid.UUID
    analysis_id: uuid.UUID


class UserStatusUpdate(SQLModel):
    is_active: bool


class EmailAttachment(SQLModel):
    filename: str = Field(max_length=255)
    content_type: str = Field(default="application/octet-stream", max_length=255)
    data_base64: str


class EmailSendRequest(SQLModel):
    to: Optional[str] = Field(default=None)
    cc: Optional[str] = Field(default=None)
    bcc: Optional[str] = Field(default=None)
    subject: Optional[str] = Field(default=None)
    body: Optional[str] = Field(default=None)
    task_id: Optional[str] = Field(default=None, max_length=255)

    # If body_html is provided, it will be used as-is inside the template.
    # Otherwise, body_text will be rendered into the template.
    # body_text: str | None = None
    # body_html: str | None = None

    # Optional MJML template name located in app/email_templates/src.
    # Defaults to "generic_message".
    # template_name: str = Field(default="generic_message", max_length=255)
    # template_context: dict[str, Any] = Field(default_factory=dict)

    # attachments: list[EmailAttachment] = Field(default_factory=list)


class EmailQueuedResponse(SQLModel):
    task_id: str
    status: str = "queued"
