from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.api.db import get_session
from app.api.models import (
    AudioTranscription,
    AudioTranscriptionPublic,
    AudioTranslation,
    AudioTranscriptionPublic,
    AudioTranslationPublic
)
from google import genai
from google.genai import types
import os
import uuid
from pathlib import Path
from typing import List

router = APIRouter()

# Configure the Google Generative AI client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Ensure media directory exists
MEDIA_DIR = Path(__file__).parent.parent.parent.parent.parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)

@router.post("/audios/transcribe", response_model=AudioTranscriptionPublic)
async def transcribe_audio(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session)
):
    """
    Upload an audio file and transcribe it to Banglish (Bangla in Roman alphabet).
    The transcription is stored in the database and returned.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = MEDIA_DIR / unique_filename
    
    # Save the uploaded file
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        file_size = len(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Upload to Google's servers and transcribe
    try:
        print(f"Uploading file to Google: {file_path}...")
        with open(file_path, 'rb') as f:
            audio_file = client.files.upload(file=f, config={'mime_type': file.content_type})
        
        print("Transcribing...")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_uri(file_uri=audio_file.uri, mime_type=audio_file.mime_type),
                "You are an expert transcriber. The audio contains a mix of Bangla and English. "
                "Transcribe the audio exactly as spoken but use the Roman alphabet (Banglish). "
                "Example: 'Amra ajke meeting korsi'. Please transcribe this audio into Banglish text."
            ]
        )
        
        transcription_text = response.text
        
    except Exception as e:
        # Clean up file if transcription fails
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    
    # Create database record
    audio_transcription = AudioTranscription(
        filename=unique_filename,
        original_filename=file.filename,
        file_size=file_size,
        mime_type=file.content_type,
        transcription_text=transcription_text
    )
    
    session.add(audio_transcription)
    await session.commit()
    await session.refresh(audio_transcription)
    
    return audio_transcription


@router.get("/audios", response_model=List[AudioTranscriptionPublic])
async def get_all_audios(
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """
    Retrieve all audio transcription records from the database.
    Supports pagination with skip and limit parameters.
    """
    statement = select(AudioTranscription).offset(skip).limit(limit).order_by(AudioTranscription.created_at.desc())
    result = await session.execute(statement)
    audios = result.scalars().all()
    return audios


@router.get("/audios/{audio_id}", response_model=AudioTranscriptionPublic)
async def get_audio_by_id(
    audio_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve a specific audio transcription record by its ID.
    """
    statement = select(AudioTranscription).where(AudioTranscription.id == audio_id)
    result = await session.execute(statement)
    audio = result.scalar_one_or_none()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio transcription not found")
    
    return audio


@router.get("/audios/{audio_id}/translations", response_model=List[AudioTranslationPublic])
async def get_translations_by_audio_id(
    audio_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve all translations for a specific audio transcription.
    """
    # First verify the audio transcription exists
    audio_statement = select(AudioTranscription).where(AudioTranscription.id == audio_id)
    audio_result = await session.execute(audio_statement)
    audio = audio_result.scalar_one_or_none()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio transcription not found")
    
    # Get all translations for this audio
    statement = select(AudioTranslation).where(AudioTranslation.audio_transcription_id == audio_id).order_by(AudioTranslation.created_at.desc())
    result = await session.execute(statement)
    translations = result.scalars().all()
    
    return translations
