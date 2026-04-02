import os
import re
import uuid
from datetime import datetime
from celery.utils.log import get_task_logger
from dotenv import load_dotenv
from google import genai
from google.genai import types
from app.worker.celery_app import celery_app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.api.models import AudioTranscription, AudioTranslation, MeetingAnalysis

load_dotenv()

# Setup Sync DB Connection for the Worker
engine = create_engine(os.getenv("SYNC_DATABASE_URL")) 
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 1. Initialize the Celery logger
logger = get_task_logger(__name__)

@celery_app.task(name="task_transcribe_audio")
def task_transcribe_audio(audio_id: str, file_path: str, mime_type: str):
    # 2. Create a FRESH session inside the task
    db = SessionLocal()

    try:
        logger.info(f"Starting Gemini processing for audio_id: {audio_id}")
        # 1. Upload to Gemini File API
        with open(file_path, 'rb') as f:
            audio_file = client.files.upload(file=f, config={'mime_type': mime_type})

            # Wait for the file to be 'ACTIVE'
            import time
            while audio_file.state.name == "PROCESSING":
                time.sleep(2)
                audio_file = client.files.get(name=audio_file.name)

            if audio_file.state.name == "FAILED":
                raise Exception("Gemini file processing failed.")
        
        # 2. Generate Content (Transcription)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_uri(file_uri=audio_file.uri, mime_type=audio_file.mime_type),
                "You are an expert transcriber. The audio contains a mix of Bangla and English. "
                "Transcribe the audio exactly as spoken but use the Roman alphabet (Banglish). "
                "Example: 'Amra ajke meeting korsi'. Please transcribe this audio into Banglish text."
                "Identify the different speakers and label them as 'Speaker 1', 'Speaker 2', etc. Include timestamps for whenever the speaker changes."
            ]
        )
        
        # 3. Update DB
        audio_record = db.query(AudioTranscription).filter(AudioTranscription.id == uuid.UUID(audio_id)).first()
        if audio_record:
            audio_record.transcription_text = response.text
            db.commit()
            logger.info(f"SUCCESS: Database updated for {audio_id}")
        else:
            logger.error(f"FAIL: Could not find record {audio_id} in the database!")
            
        # Clean up Gemini Cloud Storage (not local file, keep that for the user)
        client.files.delete(name=audio_file.name)
        
    except Exception as e:
        db.rollback() # Undo any pending changes if it crashes
        logger.error(f"CRITICAL ERROR in task: {str(e)}")
        raise e
    finally:
        db.close()

@celery_app.task(name="task_translate_audio")
def task_translate_audio(translation_id: str, source_text: str):
    db = SessionLocal()
    try:
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
        
        full_text = response.text.strip()
        
        # Parsing logic (reused from your original router)
        confidence_score = 0.85
        translated_text = full_text
        confidence_match = re.search(r'Confidence:\s*([0-9]*\.?[0-9]+)', full_text, re.IGNORECASE)
        
        if confidence_match:
            confidence_score = float(confidence_match.group(1))
            translated_text = re.sub(r'\n?Confidence:.*$', '', full_text, flags=re.IGNORECASE | re.MULTILINE).strip()

        try:
            translation_uuid = uuid.UUID(translation_id)
        except (ValueError, TypeError):
            translation_uuid = None

        if translation_uuid is not None:
            translation_record = (
                db.query(AudioTranslation)
                .filter(AudioTranslation.id == translation_uuid)
                .first()
            )
            if translation_record:
                translation_record.translated_text = translated_text
                translation_record.confidence_score = confidence_score
                db.commit()
            
    finally:
        db.close()


@celery_app.task(name="task_analyze_meeting")
def task_analyze_meeting(analysis_id: str, audio_translation_id: str, generate_markdown: bool):
    db = SessionLocal()
    try:
        logger.info(f"Starting analysis for analysis_id: {analysis_id}")
        
        # 1. Fetch the translation text
        translation = db.query(AudioTranslation).filter(
            AudioTranslation.id == uuid.UUID(audio_translation_id)
        ).first()
        
        if not translation or not translation.translated_text:
            logger.error(f"Translation {audio_translation_id} not found or empty.")
            return

        content_text = translation.translated_text

        # 2. Generate Analysis
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

        # 3. Optional Markdown Generation
        notes_markdown = None
        if generate_markdown:
            current_date = datetime.utcnow().strftime("%B %d, %Y")
            markdown_prompt = f"""Convert the following meeting analysis into a professional markdown document.

            Meeting Date: {current_date}
            Meeting Content: {content_text}

            Analysis:
            - Summary: {summary}
            - Business Insights: {business_insights}
            - Technical Insights: {technical_insights}
            - Action Items: {action_items}
            - Key Topics: {key_topics}

            Create a well-formatted markdown document with proper headings, bullet points, and sections.
            Use the provided date ({current_date}) in your document and organize information clearly."""
            
            
            mk_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[markdown_prompt]
            )
            notes_markdown = mk_response.text.strip()

        # 4. Update the Analysis Record
        analysis_record = db.query(MeetingAnalysis).filter(
            MeetingAnalysis.id == uuid.UUID(analysis_id)
        ).first()
        
        if analysis_record:
            analysis_record.summary = summary
            analysis_record.business_insights = business_insights
            analysis_record.technical_insights = technical_insights
            analysis_record.action_items = action_items if action_items != "Not available" else None
            analysis_record.key_topics = key_topics if key_topics != "Not available" else None
            analysis_record.notes_markdown = notes_markdown
            analysis_record.content_text = content_text # Store the source text used
            
            db.commit()
            logger.info(f"SUCCESS: Analysis {analysis_id} updated.")

    except Exception as e:
        db.rollback()
        logger.error(f"Analysis Task Failed: {str(e)}")
        raise e
    finally:
        db.close()


@celery_app.task(name="task_full_meeting_pipeline")
def task_full_meeting_pipeline(audio_id: str, translation_id: str, analysis_id: str, file_path: str, mime_type: str, generate_markdown: bool):
    db = SessionLocal()
    uploaded_gemini_file_name = None
    try:
        # --- STEP 1: TRANSCRIBE ---
        logger.info(f"Pipeline Step 1: Transcribing {audio_id}")
        with open(file_path, 'rb') as f:
            audio_file = client.files.upload(file=f, config={'mime_type': mime_type})
            uploaded_gemini_file_name = audio_file.name
            while audio_file.state.name == "PROCESSING":
                import time
                time.sleep(2)
                audio_file = client.files.get(name=audio_file.name)

        transcribe_resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_uri(file_uri=audio_file.uri, mime_type=audio_file.mime_type),
                "You are an expert transcriber. The audio contains a mix of Bangla and English. "
                "Transcribe the audio exactly as spoken but use the Roman alphabet (Banglish). "
                "Example: 'Amra ajke meeting korsi'. Please transcribe this audio into Banglish text."
                "Identify the different speakers and label them as 'Speaker 1', 'Speaker 2', etc. Include timestamps for whenever the speaker changes."
            ]
        )
        transcription_text = transcribe_resp.text
        
        # Update Transcription Record
        audio_rec = db.query(AudioTranscription).filter(AudioTranscription.id == uuid.UUID(audio_id)).first()
        if audio_rec is None:
            logger.error(f"AudioTranscription record not found for id={audio_id} in task_full_meeting_pipeline")
            db.rollback()
            raise ValueError(f"AudioTranscription record not found for id={audio_id}")
        audio_rec.transcription_text = transcription_text
        db.commit()

        # --- STEP 2: TRANSLATE ---
        logger.info(f"Pipeline Step 2: Translating {translation_id}")
        translate_resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                f"""You are an expert translator specializing in Banglish to English translation.
                
Banglish is Bangla language written in Roman/Latin script. Your task is to translate the following Banglish text into proper, natural English.
                
Banglish text: {transcription_text}
                
Provide ONLY the English translation. Be accurate and natural.
                
After the translation, on a new line, also provide your confidence score (0.0 to 1.0) in the format: 'Confidence: 0.95'"""
            ]
        )
        full_translate_text = translate_resp.text.strip()
        
        # Parsing confidence
        confidence = 0.85
        translated_text = full_translate_text
        conf_match = re.search(r'Confidence:\s*([0-9]*\.?[0-9]+)', full_translate_text, re.IGNORECASE)
        if conf_match:
            confidence = float(conf_match.group(1))
            translated_text = re.sub(r'\n?Confidence:.*$', '', full_translate_text, flags=re.IGNORECASE).strip()

        # Update Translation Record
        trans_rec = db.query(AudioTranslation).filter(AudioTranslation.id == uuid.UUID(translation_id)).first()
        trans_rec.source_text = transcription_text
        trans_rec.translated_text = translated_text
        trans_rec.confidence_score = confidence
        db.commit()

        # --- STEP 3: ANALYZE ---
        logger.info(f"Pipeline Step 3: Analyzing {analysis_id}")
        analysis_prompt = f"""You are an expert meeting analyst. Analyze the following meeting transcript and provide:

        1. **SUMMARY**: A brief 2-3 sentence summary of the meeting
        2. **BUSINESS INSIGHTS**: Key business implications, decisions, goals, and strategic points
        3. **TECHNICAL INSIGHTS**: Technical discussions, implementation details, technologies mentioned, and technical decisions
        4. **ACTION ITEMS**: Specific tasks, assignments, and follow-ups mentioned (if any)
        5. **KEY TOPICS**: Main topics and themes discussed

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
        analysis_resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[analysis_prompt]
        )
        analysis_text = analysis_resp.text

        def extract(name):
            pattern = rf"{name}:\s*(.+?)(?=\n[A-Z_]+:|$)"
            m = re.search(pattern, analysis_text, re.DOTALL | re.IGNORECASE)
            return m.group(1).strip() if m else "Not available"

        summary = extract("SUMMARY")
        business_insights = extract("BUSINESS_INSIGHTS")
        technical_insights = extract("TECHNICAL_INSIGHTS")
        action_items = extract("ACTION_ITEMS")
        key_topics = extract("KEY_TOPICS")

        # Optional Markdown
        notes_md = None
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

            Create a well-formatted markdown document with proper headings, bullet points, and sections.
            Use the provided date ({current_date}) in your document and organize information clearly."""
            
            mk_resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[markdown_prompt]
            )
            notes_md = mk_resp.text.strip()

        # Update Analysis Record
        analysis_rec = db.query(MeetingAnalysis).filter(MeetingAnalysis.id == uuid.UUID(analysis_id)).first()
        if analysis_rec is None:
            logger.error(f"MeetingAnalysis record not found for id={analysis_id} in task_full_meeting_pipeline")
            db.rollback()
            raise ValueError(f"MeetingAnalysis record not found for id={analysis_id}")
        analysis_rec.summary = summary
        analysis_rec.business_insights = business_insights
        analysis_rec.technical_insights = technical_insights
        analysis_rec.action_items = action_items if action_items != "Not available" else None
        analysis_rec.key_topics = key_topics if key_topics != "Not available" else None
        analysis_rec.content_text = translated_text
        analysis_rec.notes_markdown = notes_md
        db.commit()

        logger.info("Full Pipeline Completed Successfully")

    except Exception as e:
        db.rollback()
        logger.error(f"PIPELINE CRASHED: {str(e)}")
        raise e
    finally:
        db.close()
        if uploaded_gemini_file_name:
            try:
                client.files.delete(name=uploaded_gemini_file_name)
            except Exception as cleanup_err:
                logger.warning(f"Failed to delete Gemini file {uploaded_gemini_file_name}: {cleanup_err}")