from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.api.db import get_session
from app.api.v1.deps import get_current_active_user
from app.api.models import User
from typing import Annotated
from datetime import datetime
from app.api.models import (
    AudioTranscription,
    AudioTranscriptionPublic,
    AudioTranslation,
    AudioTranslationPublic,
    MeetingAnalysis,
    MeetingAnalysisCreate,
    MeetingAnalysisPublic
)
from google import genai
from google.genai import types
import os
import uuid
from pathlib import Path
from typing import List

router = APIRouter(
    prefix="/audios",
    tags=["audios"]
)

# Configure the Google Generative AI client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Ensure media directory exists
MEDIA_DIR = Path(__file__).parent.parent.parent.parent.parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)

@router.post("/transcribe", response_model=AudioTranscriptionPublic)
async def transcribe_audio(
    current_user: Annotated[User, Depends(get_current_active_user)],
    file: UploadFile = File(...),
    title: str = "Untitled",
    session: AsyncSession = Depends(get_session)
):
    """
    Upload an audio file and transcribe it to Banglish (Bangla in Roman alphabet).
    The transcription is stored in the database and returned.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    # Generate filename with Title_Client_Timestamp format
    file_extension = Path(file.filename).suffix
    client_uuid = str(current_user.id)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    clean_title = title.replace(" ", "_").replace("/", "_").replace("\\", "_")

    ## Should be replaced with the meeting client uuid not with the user uuid who initiated the upload
    unique_filename = f"{clean_title}_{client_uuid}_{timestamp}{file_extension}"
    
    # Create client-specific directory
    client_dir = MEDIA_DIR / client_uuid
    client_dir.mkdir(exist_ok=True)
    file_path = client_dir / unique_filename
    
    # 1. Save locally
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    

    # 2. Create DB record with EMPTY transcription_text
    audio_transcription = AudioTranscription(
        id=uuid.uuid4(), # Explicitly generate ID to pass to task
        filename=unique_filename,
        original_filename=file.filename,
        file_size=len(contents),
        mime_type=file.content_type,
        transcription_text=None, # Will be filled by worker
        user_id=current_user.id
    )
    
    session.add(audio_transcription)
    await session.commit()
    await session.refresh(audio_transcription)
    
    # 3. Trigger Background Task
    from app.worker.tasks import task_transcribe_audio
    task_transcribe_audio.delay(
        str(audio_transcription.id), 
        str(file_path), 
        file.content_type
    )
    
    return audio_transcription


@router.get("/", response_model=List[AudioTranscriptionPublic])
async def get_all_audios(
    current_user: Annotated[User, Depends(get_current_active_user)],
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """
    Retrieve all audio transcription records from the database.
    Supports pagination with skip and limit parameters.
    """
    statement = select(AudioTranscription).where(AudioTranscription.user_id == current_user.id).offset(skip).limit(limit).order_by(AudioTranscription.created_at.desc())
    result = await session.exec(statement)
    audios = result.all()
    return audios


@router.post("/analyses", response_model=MeetingAnalysisPublic)
async def create_meeting_analysis(
    current_user: Annotated[User, Depends(get_current_active_user)],
    analysis_data: MeetingAnalysisCreate,
    session: AsyncSession = Depends(get_session)
):
    # 1. Quick check if translation exists (Async)
    statement = select(AudioTranslation).where(
        AudioTranslation.user_id == current_user.id, 
        AudioTranslation.id == analysis_data.audio_translation_id
    )
    result = await session.exec(statement)
    if not result.first():
        raise HTTPException(status_code=404, detail="Audio translation not found")

    # 2. Create the record in 'Pending' state
    new_analysis = MeetingAnalysis(
        audio_translation_id=analysis_data.audio_translation_id,
        user_id=current_user.id,
        model_used="gemini-2.5-flash",
        summary="Processing...",  # Placeholder
        content_text="Processing...",  # Placeholder to satisfy MeetingAnalysisPublic
        business_insights="Processing...",  # Placeholder to satisfy MeetingAnalysisPublic
        technical_insights="Processing..."  # Placeholder to satisfy MeetingAnalysisPublic
    )
    session.add(new_analysis)
    await session.commit()
    await session.refresh(new_analysis)

    # 3. Trigger Celery
    from app.worker.tasks import task_analyze_meeting
    task_analyze_meeting.delay(
        str(new_analysis.id), 
        str(analysis_data.audio_translation_id), 
        analysis_data.generate_markdown
    )

    return new_analysis

@router.get("/analyses", response_model=List[MeetingAnalysisPublic])
async def get_all_analyses(
    current_user: Annotated[User, Depends(get_current_active_user)],
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """
    Retrieve all meeting analysis records from the database.
    Supports pagination with skip and limit parameters.
    """
    
    statement = select(MeetingAnalysis).where(MeetingAnalysis.user_id == current_user.id).offset(skip).limit(limit).order_by(MeetingAnalysis.created_at.desc())
    result = await session.exec(statement)
    analyses = result.all()
    return analyses


@router.get("/analyses/{analysis_id}", response_model=MeetingAnalysisPublic)
async def get_analysis_by_id(
    current_user: Annotated[User, Depends(get_current_active_user)],
    analysis_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve a specific meeting analysis by its ID.
    """
    statement = select(MeetingAnalysis).where(MeetingAnalysis.user_id == current_user.id, MeetingAnalysis.id == analysis_id)
    result = await session.exec(statement)
    analysis = result.all()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Meeting analysis not found")
    return analysis[0]


@router.get("/{audio_id}", response_model=AudioTranscriptionPublic)
async def get_audio_by_id(
    current_user: Annotated[User, Depends(get_current_active_user)],
    audio_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve a specific audio transcription record by its ID.
    """
    statement = select(AudioTranscription).where(AudioTranscription.user_id == current_user.id, AudioTranscription.id == audio_id)
    result = await session.exec(statement)
    audio = result.all()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio transcription not found")
    
    return audio[0]


@router.get("/{audio_id}/translations", response_model=List[AudioTranslationPublic])
async def get_translations_by_audio_id(
    current_user: Annotated[User, Depends(get_current_active_user)],
    audio_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve all translations for a specific audio transcription.
    """
    # First verify the audio transcription exists
    audio_statement = select(AudioTranscription).where(AudioTranscription.user_id == current_user.id, AudioTranscription.id == audio_id)
    audio_result = await session.exec(audio_statement)
    audio = audio_result.all()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio transcription not found")
    
    # Get all translations for this audio
    statement = select(AudioTranslation).where(AudioTranslation.user_id == current_user.id, AudioTranslation.audio_transcription_id == audio_id).order_by(AudioTranslation.created_at.desc())
    result = await session.exec(statement)
    translations = result.all()
    
    return translations

