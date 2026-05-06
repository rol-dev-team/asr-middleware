import os
import re
import time
import uuid
import base64
import shutil
import smtplib
import ssl
import subprocess
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined
from markupsafe import escape
from celery.utils.log import get_task_logger
from dotenv import load_dotenv
from google import genai
from google.genai import types
from app.worker.celery_app import celery_app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.api.models import AudioTranscription, AudioTranslation, MeetingAnalysis

# Maximum time (in seconds) to wait for Gemini file processing before giving up
_GEMINI_POLL_TIMEOUT = 120
_GEMINI_POLL_INTERVAL = 2

load_dotenv()

# Setup Sync DB Connection for the Worker
engine = create_engine(os.getenv("SYNC_DATABASE_URL")) 
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 1. Initialize the Celery logger
logger = get_task_logger(__name__)


_TEMPLATES_SRC_DIR = Path(__file__).resolve().parents[1] / "email_templates" / "src"
_MEDIA_DIR = Path(__file__).resolve().parents[2] / "media"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_SRC_DIR)),
    autoescape=True,
    undefined=StrictUndefined,
)


def _coerce_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _compile_mjml_to_html(mjml_source: str) -> str | None:
    """Compile MJML to HTML using the `mjml` CLI if present.

    Returns None if mjml isn't available.
    """
    if shutil.which("mjml") is None:
        return None

    # Try a couple common CLI invocations.
    for args in (["mjml", "-s", "--stdin"], ["mjml", "-s"]):
        try:
            proc = subprocess.run(
                args,
                input=mjml_source,
                text=True,
                capture_output=True,
                check=False,
            )
            if proc.returncode == 0 and proc.stdout.strip():
                return proc.stdout
        except Exception:
            continue

    return None


def _wrap_fallback_html(subject: str, body_html: str) -> str:
    # Minimal professional wrapper if MJML isn't available.
    safe_subject = escape(subject)
    return f"""<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>{safe_subject}</title>
  </head>
  <body style=\"margin:0;background:#f3f4f6;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;\">
    <div style=\"max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;\">
      <h2 style=\"margin:0 0 12px 0;font-size:18px;\">{safe_subject}</h2>
      <div style=\"font-size:14px;line-height:22px;\">{body_html}</div>
      <hr style=\"border:none;border-top:1px solid #e5e7eb;margin:20px 0\" />
      <div style=\"font-size:12px;color:#6b7280\">This message was sent automatically.</div>
    </div>
  </body>
</html>"""


def _render_email_html(payload: dict[str, Any]) -> tuple[str, str]:
    subject = str(payload.get("subject") or "")
    app_name = os.getenv("APP_NAME", "ASR Middleware")

    body = payload.get("body")
    body_html = payload.get("body_html")
    body_text = payload.get("body_text")

    if body_html is None:
        # Convert plain text to basic HTML.
        text = body_text or body or ""
        body_html = "<p>" + escape(text).replace("\n", "<br/>") + "</p>"

    if body_text is None:
        # Fallback: strip tags very roughly.
        body_text = body or re.sub(r"<[^>]+>", "", str(body_html))

    template_name = str(payload.get("template_name") or "generic_message")
    if not template_name.endswith(".mjml"):
        template_name = f"{template_name}.mjml"

    template_context: dict[str, Any] = payload.get("template_context") or {}
    context = {
        "app_name": app_name,
        "subject": subject,
        "heading": template_context.get("heading") or subject or "Message",
        "preheader": template_context.get("preheader") or subject,
        "body_html": body_html,
        **template_context,
    }

    try:
        mjml_template = _jinja_env.get_template(template_name)
        mjml_source = mjml_template.render(**context)
    except Exception as e:
        logger.warning(f"MJML template render failed ({template_name}): {e}")
        return _wrap_fallback_html(subject, str(body_html)), str(body_text)

    compiled_html = _compile_mjml_to_html(mjml_source)
    if compiled_html is None:
        logger.warning("MJML compiler not available; using fallback HTML wrapper")
        return _wrap_fallback_html(subject, str(body_html)), str(body_text)

    return compiled_html, str(body_text)


def _load_analysis_pdf_attachment(task_id: str) -> dict[str, Any]:
    file_path = _MEDIA_DIR / task_id / "Meeting_Minutes.pdf"
    if not file_path.exists():
        raise FileNotFoundError(f"Meeting_Minutes.pdf not found for task_id={task_id}")

    return {
        "filename": "Meeting_Minutes.pdf",
        "content_type": "application/pdf",
        "data_base64": base64.b64encode(file_path.read_bytes()).decode("ascii"),
    }


@celery_app.task(name="task_send_smtp_email")
def task_send_smtp_email(payload: dict[str, Any]) -> dict[str, Any]:
    """Send an SMTP email in the background.
    Payload is expected to match EmailSendRequest.model_dump().
    """
    smtp_host = os.getenv("MAIL_HOST") or os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("MAIL_PORT") or os.getenv("SMTP_PORT") or "587")
    smtp_user = os.getenv("MAIL_USERNAME") or os.getenv("SMTP_USER")
    smtp_password = os.getenv("MAIL_PASSWORD") or os.getenv("SMTP_PASSWORD")
    mail_encryption = (os.getenv("MAIL_ENCRYPTION") or "").strip().lower()
    smtp_tls = _coerce_bool(os.getenv("SMTP_TLS"), default=mail_encryption in {"tls", "starttls"})
    smtp_ssl = _coerce_bool(os.getenv("SMTP_SSL"), default=mail_encryption == "ssl")
    from_email = os.getenv("MAIL_FROM_ADDRESS") or os.getenv("SMTP_FROM") or smtp_user or ""
    from_name = os.getenv("MAIL_FROM_NAME", os.getenv("SMTP_FROM_NAME", os.getenv("APP_NAME", "ASR Middleware")))

    if not smtp_host:
        raise RuntimeError("MAIL_HOST is not set")
    if not from_email:
        raise RuntimeError("MAIL_FROM_ADDRESS (or MAIL_USERNAME) is not set")

    subject = str(payload.get("subject") or "")
    to_list = [item.strip() for item in str(payload.get("to") or "").split(",") if item.strip()]
    cc_list = [item.strip() for item in str(payload.get("cc") or "").split(",") if item.strip()]
    bcc_list = [item.strip() for item in str(payload.get("bcc") or "").split(",") if item.strip()]
    recipients = [*to_list, *cc_list, *bcc_list]

    if not recipients:
        raise ValueError("At least one recipient must be provided")

    attachments = list(payload.get("attachments") or [])
    task_id = str(payload.get("task_id") or "").strip()
    if task_id:
        attachments.insert(0, _load_analysis_pdf_attachment(task_id))

    html_body, text_body = _render_email_html(payload)

    # ── Build a proper multipart/mixed message ──────────────────────────────
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders as email_encoders

    # Outer container: multipart/mixed allows attachments
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = ", ".join(to_list)
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)

    # Inner alternative part: plain-text fallback + HTML
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(text_body, "plain", "utf-8"))
    alt.attach(MIMEText(html_body, "html", "utf-8"))  # HTML is last → highest priority
    msg.attach(alt)
    # ───────────────────────────────────────────────────────────────────────

    for att in attachments:
        try:
            filename = str(att.get("filename") or "attachment")
            content_type = str(att.get("content_type") or "application/octet-stream")
            data_b64 = att.get("data_base64")
            if not data_b64:
                continue
            data = base64.b64decode(data_b64)

            if "/" in content_type:
                maintype, subtype = content_type.split("/", 1)
            else:
                maintype, subtype = "application", "octet-stream"

            part = MIMEBase(maintype, subtype)
            part.set_payload(data)
            email_encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)
        except Exception as e:
            logger.warning(f"Failed to attach file: {e}")

    context = ssl.create_default_context()
    server: smtplib.SMTP | smtplib.SMTP_SSL
    if smtp_ssl:
        server = smtplib.SMTP_SSL(smtp_host, smtp_port, context=context)
    else:
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.ehlo()
        if smtp_tls:
            server.starttls(context=context)
            server.ehlo()

    try:
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        server.send_message(msg, to_addrs=recipients)
        logger.info(f"Email sent to={to_list} cc={cc_list} bcc_count={len(bcc_list)}")
        return {"sent": True, "recipients": recipients}
    finally:
        try:
            server.quit()
        except Exception:
            pass

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
            elapsed = 0
            while audio_file.state.name == "PROCESSING":
                if elapsed >= _GEMINI_POLL_TIMEOUT:
                    raise TimeoutError(
                        f"Gemini file processing timed out after {_GEMINI_POLL_TIMEOUT}s "
                        f"for audio_id={audio_id}"
                    )
                time.sleep(_GEMINI_POLL_INTERVAL)
                elapsed += _GEMINI_POLL_INTERVAL
                audio_file = client.files.get(name=audio_file.name)

            if audio_file.state.name == "FAILED":
                raise ValueError(f"Gemini file processing failed for audio_id={audio_id}")
            if audio_file.state.name != "ACTIVE":
                raise ValueError(
                    f"Gemini file in unexpected state '{audio_file.state.name}' "
                    f"for audio_id={audio_id}"
                )
        
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
            elapsed = 0
            while audio_file.state.name == "PROCESSING":
                if elapsed >= _GEMINI_POLL_TIMEOUT:
                    raise TimeoutError(
                        f"Gemini file processing timed out after {_GEMINI_POLL_TIMEOUT}s "
                        f"for audio_id={audio_id}"
                    )
                time.sleep(_GEMINI_POLL_INTERVAL)
                elapsed += _GEMINI_POLL_INTERVAL
                audio_file = client.files.get(name=audio_file.name)

            if audio_file.state.name == "FAILED":
                raise ValueError(f"Gemini file processing failed for audio_id={audio_id}")
            if audio_file.state.name != "ACTIVE":
                raise ValueError(
                    f"Gemini file in unexpected state '{audio_file.state.name}' "
                    f"for audio_id={audio_id}"
                )

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
        if trans_rec is None:
            logger.error(f"AudioTranslation record not found for id={translation_id} in task_full_meeting_pipeline")
            db.rollback()
            raise ValueError(f"AudioTranslation record not found for id={translation_id}")
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