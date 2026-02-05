from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.api.db import get_session
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

router = APIRouter()

# Configure the Google Generative AI client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Ensure media directory exists
MEDIA_DIR = Path(__file__).parent.parent.parent.parent.parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)

@router.post("/transcribe", response_model=AudioTranscriptionPublic)
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


@router.get("/", response_model=List[AudioTranscriptionPublic])
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


@router.post("/analyses", response_model=MeetingAnalysisPublic)
async def create_meeting_analysis(
    analysis_data: MeetingAnalysisCreate,
    session: AsyncSession = Depends(get_session)
):
    """
    Generate comprehensive business and technical analysis from audio translation.
    Similar to Fireflies.ai analysis - extracts insights, action items, and can generate markdown notes.
    """
    # Verify the audio translation exists
    statement = select(AudioTranslation).where(AudioTranslation.id == analysis_data.audio_translation_id)
    result = await session.execute(statement)
    translation = result.scalar_one_or_none()
    
    if not translation:
        raise HTTPException(status_code=404, detail="Audio translation not found")
    
    content_text = translation.translated_text
    
    if not content_text:
        raise HTTPException(status_code=400, detail="No translated text available to analyze")
    
    # Generate analysis using Gemini API
    try:
        print("Generating business and technical analysis...")
        
        analysis_prompt = f"""You are an expert meeting analyst. Analyze the following meeting transcript and provide:

1. **SUMMARY**: A brief 2-3 sentence summary of the meeting
2. **BUSINESS INSIGHTS**: Key business implications, decisions, goals, and strategic points
3. **TECHNICAL INSIGHTS**: Technical discussions, implementation details, technologies mentioned, and technical decisions
4. **ACTION ITEMS**: Specific tasks, assignments, and follow-ups mentioned (if any)
5. **KEY TOPICS**: Main topics and themes discussed

Transcript:
{content_text}

Provide your response in this exact format:

SUMMARY:
[Your summary here]

BUSINESS_INSIGHTS:
[Your business insights here]

TECHNICAL_INSIGHTS:
[Your technical insights here]

ACTION_ITEMS:
[Your action items here, or 'None identified' if there are none]

KEY_TOPICS:
[Your key topics here]
"""
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[analysis_prompt]
        )
        
        response_text = response.text.strip()
        
        # Parse the response
        def extract_section(text: str, section_name: str) -> str:
            import re
            pattern = rf"{section_name}:\s*(.+?)(?=\n[A-Z_]+:|$)"
            match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            if match:
                return match.group(1).strip()
            return "Not available"
        
        summary = extract_section(response_text, "SUMMARY")
        business_insights = extract_section(response_text, "BUSINESS_INSIGHTS")
        technical_insights = extract_section(response_text, "TECHNICAL_INSIGHTS")
        action_items = extract_section(response_text, "ACTION_ITEMS")
        key_topics = extract_section(response_text, "KEY_TOPICS")
        
        # Generate markdown notes if requested
        notes_markdown = None
        if analysis_data.generate_markdown:
            print("Generating markdown notes...")
            markdown_prompt = f"""Convert the following meeting analysis into a professional markdown document.

Meeting Content: {content_text}

Analysis:
- Summary: {summary}
- Business Insights: {business_insights}
- Technical Insights: {technical_insights}
- Action Items: {action_items}
- Key Topics: {key_topics}

Create a well-formatted markdown document with proper headings, bullet points, and sections.
Include a title, date placeholder, and organize information clearly."""
            
            markdown_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[markdown_prompt]
            )
            notes_markdown = markdown_response.text.strip()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis generation failed: {str(e)}")
    
    # Create database record
    analysis = MeetingAnalysis(
        audio_translation_id=analysis_data.audio_translation_id,
        content_text=content_text,
        summary=summary,
        business_insights=business_insights,
        technical_insights=technical_insights,
        action_items=action_items if action_items != "Not available" else None,
        key_topics=key_topics if key_topics != "Not available" else None,
        notes_markdown=notes_markdown,
        model_used="gemini-2.5-flash"
    )
    
    session.add(analysis)
    await session.commit()
    await session.refresh(analysis)
    
    return analysis


@router.get("/analyses", response_model=List[MeetingAnalysisPublic])
async def get_all_analyses(
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """
    Retrieve all meeting analysis records from the database.
    Supports pagination with skip and limit parameters.
    """
    statement = select(MeetingAnalysis).offset(skip).limit(limit).order_by(MeetingAnalysis.created_at.desc())
    result = await session.execute(statement)
    analyses = result.scalars().all()
    return analyses


@router.get("/analyses/{analysis_id}", response_model=MeetingAnalysisPublic)
async def get_analysis_by_id(
    analysis_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve a specific meeting analysis by its ID.
    """
    statement = select(MeetingAnalysis).where(MeetingAnalysis.id == analysis_id)
    result = await session.execute(statement)
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Meeting analysis not found")
    
    return analysis


@router.get("/{audio_id}", response_model=AudioTranscriptionPublic)
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


@router.get("/{audio_id}/translations", response_model=List[AudioTranslationPublic])
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

