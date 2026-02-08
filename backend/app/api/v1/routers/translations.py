from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.api.db import get_session
from app.api.v1.deps import get_current_active_user
from app.api.models import User
from typing import Annotated
from app.api.models import (
    AudioTranscription, 
    AudioTranslation,
    AudioTranslationCreate,
    AudioTranslationPublic,
    MeetingAnalysis,
    MeetingAnalysisPublic
)
from google import genai
import os
import uuid
from pathlib import Path
from typing import List
import re

router = APIRouter()

# Configure the Google Generative AI client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Ensure media directory exists
MEDIA_DIR = Path(__file__).parent.parent.parent.parent.parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)


@router.post("/", response_model=AudioTranslationPublic)
async def translate_banglish_to_english(
    current_user: Annotated[User, Depends(get_current_active_user)],
    translation_data: AudioTranslationCreate,
    session: AsyncSession = Depends(get_session)
):
    """
    Translate Banglish text to pure English.
    Takes the transcription_text from an AudioTranscription and translates it.
    Returns the translation with a confidence score.
    """
    # First verify the audio transcription exists
    statement = select(AudioTranscription).where(AudioTranscription.id == translation_data.audio_transcription_id)
    result = await session.exec(statement)
    audio = result.all()
    
    if not audio:
        raise HTTPException(status_code=404, detail="Audio transcription not found")
    
    # Use the source_text from the request or fall back to the audio's transcription_text
    source_text = translation_data.source_text or audio[0].transcription_text
    
    if not source_text:
        raise HTTPException(status_code=400, detail="No text available to translate")
    
    # Translate using Gemini API
    try:
        print("Translating Banglish to English...")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                f"""You are an expert translator specializing in Banglish to English translation.
                
Banglish is Bangla language written in Roman/Latin script. Your task is to translate the following Banglish text into proper, natural English.
                
Banglish text: {source_text}
                
Provide ONLY the English translation. Be accurate and natural.
                
After the translation, on a new line, also provide your confidence score (0.0 to 1.0) in the format: 'Confidence: 0.95'"""
            ]
        )
        
        response_text = response.text.strip()
        
        # Try to extract confidence score if provided
        confidence_score = None
        translated_text = response_text
        
        # Look for confidence score in the response
        confidence_match = re.search(r'Confidence:\s*([0-9]*\.?[0-9]+)', response_text, re.IGNORECASE)
        if confidence_match:
            try:
                confidence_score = float(confidence_match.group(1))
                # Remove the confidence line from the translated text
                translated_text = re.sub(r'\n?Confidence:\s*[0-9]*\.?[0-9]+.*$', '', response_text, flags=re.IGNORECASE).strip()
            except ValueError:
                pass
        
        # If no confidence found, estimate based on response quality (simple heuristic)
        if confidence_score is None:
            # Default confidence score
            confidence_score = 0.85
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")
    
    # Create database record
    translation = AudioTranslation(
        audio_transcription_id=translation_data.audio_transcription_id,
        source_text=source_text,
        translated_text=translated_text,
        confidence_score=confidence_score,
        user_id=current_user.id,
        model_used="gemini-2.5-flash"
    )
    
    session.add(translation)
    await session.commit()
    await session.refresh(translation)
    
    return translation


@router.get("/", response_model=List[AudioTranslationPublic])
async def get_all_translations(
    current_user: Annotated[User, Depends(get_current_active_user)],
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """
    Retrieve all translation records from the database.
    Supports pagination with skip and limit parameters.
    """
    statement = select(AudioTranslation).where(AudioTranslation.user_id == current_user.id).offset(skip).limit(limit).order_by(AudioTranslation.created_at.desc())
    result = await session.exec(statement)
    translations = result.all()
    return translations


@router.get("/{translation_id}", response_model=AudioTranslationPublic)
async def get_translation_by_id(
    current_user: Annotated[User, Depends(get_current_active_user)],
    translation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve a specific translation record by its ID.
    """
    statement = select(AudioTranslation).where(AudioTranslation.user_id == current_user.id, AudioTranslation.id == translation_id)
    result = await session.exec(statement)
    translation = result.all()
    
    if not translation:
        raise HTTPException(status_code=404, detail="Translation not found")
    
    return translation


@router.get("/{translation_id}/analyses", response_model=List[MeetingAnalysisPublic])
async def get_analyses_by_translation_id(
    current_user: Annotated[User, Depends(get_current_active_user)],
    translation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve all analyses for a specific audio translation.
    """
    # First verify the translation exists
    translation_statement = select(AudioTranslation).where(AudioTranslation.user_id == current_user.id, AudioTranslation.id == translation_id)
    translation_result = await session.exec(translation_statement)
    translation = translation_result.all()
    
    if not translation:
        raise HTTPException(status_code=404, detail="Audio translation not found")
    
    # Get all analyses for this translation
    statement = select(MeetingAnalysis).where(MeetingAnalysis.user_id == current_user.id, MeetingAnalysis.audio_translation_id == translation_id).order_by(MeetingAnalysis.created_at.desc())
    result = await session.exec(statement)
    analyses = result.all()
    
    return analyses