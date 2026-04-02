from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.api.db import get_session
from app.api.v1.deps import get_current_active_user
from app.api.models import User, FullPipeline
from typing import Annotated
from datetime import datetime
from app.api.models import (
    AudioTranscription,
    AudioTranslation,
    MeetingAnalysis,
)
from google import genai
from google.genai import types
import os
import uuid
from pathlib import Path

router = APIRouter(
    prefix="/utils",
    tags=["utils"]
)

# Configure the Google Generative AI client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Ensure media directory exists
MEDIA_DIR = Path(__file__).parent.parent.parent.parent.parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)

@router.post("/full-analysis", response_model=FullPipeline)
async def create_full_analysis_pipeline(
    current_user: Annotated[User, Depends(get_current_active_user)],
    file: UploadFile = File(...),
    title: str = "Untitled",
    generate_markdown: bool = True,
    session: AsyncSession = Depends(get_session)
):
    # 1. Basic File Validation & Storage
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be audio")
    
    contents = await file.read()
    client_uuid = str(current_user.id)
    unique_filename = f"{title.replace(' ', '_')}_{uuid.uuid4().hex[:8]}{Path(file.filename).suffix}"
    
    client_dir = MEDIA_DIR / client_uuid
    client_dir.mkdir(exist_ok=True)
    file_path = client_dir / unique_filename
    
    with open(file_path, "wb") as f:
        f.write(contents)

    # 2. Pre-create ALL Database Records (The "Instant" part)
    # A. Transcription
    audio_transcription = AudioTranscription(
        id=uuid.uuid4(),
        filename=unique_filename,
        original_filename=file.filename,
        file_size=len(contents),
        mime_type=file.content_type,
        user_id=current_user.id,
        transcription_text="Processing..."
    )
    
    # B. Translation
    audio_translation = AudioTranslation(
        id=uuid.uuid4(),
        audio_transcription_id=audio_transcription.id,
        source_text="Waiting for transcription...",
        translated_text="Processing...",
        user_id=current_user.id
    )
    
    # C. Analysis
    meeting_analysis = MeetingAnalysis(
        id=uuid.uuid4(),
        audio_translation_id=audio_translation.id,
        user_id=current_user.id,
        summary="Processing..."
    )

    session.add(audio_transcription)
    session.add(audio_translation)
    session.add(meeting_analysis)
    
    await session.commit()
    await session.refresh(audio_transcription)

    # 3. Trigger the Master Pipeline Task
    from app.worker.tasks import task_full_meeting_pipeline
    task_full_meeting_pipeline.delay(
        str(audio_transcription.id),
        str(audio_translation.id),
        str(meeting_analysis.id),
        str(file_path),
        file.content_type,
        generate_markdown
    )

    result = FullPipeline(
        transcription_id=audio_transcription.id,
        translation_id=audio_translation.id,
        analysis_id=meeting_analysis.id
    )

    return result