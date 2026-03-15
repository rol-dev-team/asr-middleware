import asyncio
import os
import re
import uuid
from datetime import datetime


from google import genai
from google.genai import types
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import select

from app.api.models import AudioTranscription, AudioTranslation, MeetingAnalysis, ProcessingJob
from app.worker.celery_app import celery_app

DATABASE_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def _extract_section(text: str, section_name: str) -> str:
    pattern = rf"{section_name}:\s*(.+?)(?=\n[A-Z_]+:|$)"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return "Not available"


async def _update_job(
    session,
    job: ProcessingJob | None,
    *,
    status: str | None = None,
    stage: str | None = None,
    progress: int | None = None,
    error_message: str | None = None,
    audio_transcription_id: uuid.UUID | None = None,
    audio_translation_id: uuid.UUID | None = None,
    meeting_analysis_id: uuid.UUID | None = None,
):
    # If the ProcessingJob record is missing (e.g., API and worker using
    # different databases), skip job-status updates but still allow the
    # pipeline to run so that transcription/translation/analysis records
    # can be created.
    if job is None:
        return

    if status is not None:
        job.status = status
    if stage is not None:
        job.stage = stage
    if progress is not None:
        job.progress = progress
    if error_message is not None:
        job.error_message = error_message
    if audio_transcription_id is not None:
        job.audio_transcription_id = audio_transcription_id
    if audio_translation_id is not None:
        job.audio_translation_id = audio_translation_id
    if meeting_analysis_id is not None:
        job.meeting_analysis_id = meeting_analysis_id

    job.updated_at = datetime.utcnow()
    session.add(job)
    await session.commit()
    await session.refresh(job)


async def _run_pipeline(
    *,
    job_id: str,
    file_path: str,
    mime_type: str,
    original_filename: str,
    user_id: str,
    title: str,
    generate_markdown: bool,
):
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    client = genai.Client(api_key=GEMINI_API_KEY)
    engine = create_async_engine(DATABASE_URL, echo=False, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        statement = select(ProcessingJob).where(ProcessingJob.id == uuid.UUID(job_id))
        result = await session.execute(statement)
        job = result.scalars().first()

        await _update_job(session, job, status="processing", stage="transcribing", progress=10)

        with open(file_path, "rb") as f:
            uploaded_audio = client.files.upload(file=f, config={"mime_type": mime_type})

        transcription_response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_uri(file_uri=uploaded_audio.uri, mime_type=uploaded_audio.mime_type),
                "You are an expert transcriber. The audio contains a mix of Bangla and English. "
                "Transcribe the audio exactly as spoken but use the Roman alphabet (Banglish). "
                "Identify the different speakers and label them as 'Speaker 1', 'Speaker 2', etc. "
                "Include timestamps whenever the speaker changes.",
            ],
        )
        transcription_text = (transcription_response.text or "").strip()

        audio_transcription = AudioTranscription(
            filename=os.path.basename(file_path),
            original_filename=original_filename,
            file_size=os.path.getsize(file_path),
            mime_type=mime_type,
            transcription_text=transcription_text,
            user_id=uuid.UUID(user_id),
        )
        session.add(audio_transcription)
        await session.commit()
        await session.refresh(audio_transcription)

        await _update_job(
            session,
            job,
            stage="transcribed",
            progress=40,
            audio_transcription_id=audio_transcription.id,
        )

        await _update_job(session, job, stage="translating", progress=50)

        translation_response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                f"""You are an expert translator specializing in Banglish to English translation.

Banglish is Bangla language written in Roman/Latin script. Translate the text below to natural English.

Banglish text: {transcription_text}

Return only the translation. On a new line also return confidence in this format: Confidence: 0.95"""
            ],
        )

        translation_text_raw = (translation_response.text or "").strip()
        confidence_score = 0.85
        translated_text = translation_text_raw

        confidence_match = re.search(r"Confidence:\s*([0-9]*\.?[0-9]+)", translation_text_raw, re.IGNORECASE)
        if confidence_match:
            try:
                confidence_score = float(confidence_match.group(1))
                translated_text = re.sub(
                    r"\n?Confidence:\s*[0-9]*\.?[0-9]+.*$",
                    "",
                    translation_text_raw,
                    flags=re.IGNORECASE,
                ).strip()
            except ValueError:
                confidence_score = 0.85

        audio_translation = AudioTranslation(
            audio_transcription_id=audio_transcription.id,
            source_text=transcription_text,
            translated_text=translated_text,
            confidence_score=confidence_score,
            user_id=uuid.UUID(user_id),
            model_used="gemini-2.5-flash",
        )
        session.add(audio_translation)
        await session.commit()
        await session.refresh(audio_translation)

        await _update_job(
            session,
            job,
            stage="translated",
            progress=70,
            audio_translation_id=audio_translation.id,
        )

        await _update_job(session, job, stage="analyzing", progress=80)

        analysis_prompt = f"""You are an expert meeting analyst. Analyze the following meeting transcript and provide:

1. SUMMARY: A brief 2-3 sentence summary of the meeting
2. BUSINESS_INSIGHTS: Key business implications, decisions, goals, and strategic points
3. TECHNICAL_INSIGHTS: Technical discussions, implementation details, technologies mentioned, and technical decisions
4. ACTION_ITEMS: Specific tasks, assignments, and follow-ups mentioned (if any)
5. KEY_TOPICS: Main topics and themes discussed

Transcript:
{translated_text}

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

        analysis_response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[analysis_prompt],
        )
        response_text = (analysis_response.text or "").strip()

        summary = _extract_section(response_text, "SUMMARY")
        business_insights = _extract_section(response_text, "BUSINESS_INSIGHTS")
        technical_insights = _extract_section(response_text, "TECHNICAL_INSIGHTS")
        action_items = _extract_section(response_text, "ACTION_ITEMS")
        key_topics = _extract_section(response_text, "KEY_TOPICS")

        notes_markdown = None
        if generate_markdown:
            current_date = datetime.utcnow().strftime("%B %d, %Y")
            markdown_prompt = f"""Convert the following meeting analysis into a professional markdown document.

Meeting Date: {current_date}
Meeting Content: {translated_text}

Analysis:
- Summary: {summary}
- Business Insights: {business_insights}
- Technical Insights: {technical_insights}
- Action Items: {action_items}
- Key Topics: {key_topics}

Create a well-formatted markdown document with clear sections and headings."""
            markdown_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[markdown_prompt],
            )
            notes_markdown = (markdown_response.text or "").strip()

        analysis = MeetingAnalysis(
            audio_translation_id=audio_translation.id,
            content_text=translated_text,
            summary=summary,
            business_insights=business_insights,
            technical_insights=technical_insights,
            action_items=action_items if action_items != "Not available" else None,
            key_topics=key_topics if key_topics != "Not available" else None,
            notes_markdown=notes_markdown,
            user_id=uuid.UUID(user_id),
            model_used="gemini-2.5-flash",
        )
        session.add(analysis)
        await session.commit()
        await session.refresh(analysis)

        await _update_job(
            session,
            job,
            status="completed",
            stage="completed",
            progress=100,
            meeting_analysis_id=analysis.id,
        )

    await engine.dispose()


@celery_app.task(name="app.worker.tasks.process_audio_pipeline", bind=True)
def process_audio_pipeline(
    self,
    *,
    job_id: str,
    file_path: str,
    mime_type: str,
    original_filename: str,
    user_id: str,
    title: str,
    generate_markdown: bool = True,
):
    try:
        asyncio.run(
            _run_pipeline(
                job_id=job_id,
                file_path=file_path,
                mime_type=mime_type,
                original_filename=original_filename,
                user_id=user_id,
                title=title,
                generate_markdown=generate_markdown,
            )
        )
    except Exception as exc:
        async def _mark_failed():
            if not DATABASE_URL:
                return
            engine = create_async_engine(DATABASE_URL, echo=False, future=True)
            session_factory = async_sessionmaker(engine, expire_on_commit=False)
            async with session_factory() as session:
                statement = select(ProcessingJob).where(ProcessingJob.id == uuid.UUID(job_id))
                result = await session.execute(statement)
                job = result.scalars().first()
                await _update_job(
                    session,
                    job,
                    status="failed",
                    stage="failed",
                    progress=100,
                    error_message=str(exc),
                )
            await engine.dispose()

        asyncio.run(_mark_failed())
        raise
