import os
import re
import time
import uuid
from datetime import datetime
from pathlib import Path
from celery.utils.log import get_task_logger
from dotenv import load_dotenv
from google import genai
from google.genai import types
from app.worker.celery_app import celery_app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.api.models import AudioTranscription, AudioTranslation, MeetingAnalysis


MEDIA_DIR = Path(__file__).resolve().parents[2] / "media"
MEDIA_DIR.mkdir(exist_ok=True)


def _derive_meeting_title_from_filename(filename: str | None) -> str | None:
    if not filename:
        return None

    stem = Path(filename).stem

    # Pattern A: utils/full-analysis => <safe_title>_<8hex>
    m = re.match(r"^(?P<title>.+)_[0-9a-fA-F]{8}$", stem)
    if m:
        raw_title = m.group("title")
    else:
        # Pattern B: /audios/transcribe => <clean_title>_<uuid>_<YYYYMMDD>_<HHMMSS>
        m = re.match(r"^(?P<title>.+)_[0-9a-fA-F-]{36}_[0-9]{8}_[0-9]{6}$", stem)
        raw_title = m.group("title") if m else stem

    pretty = re.sub(r"_+", " ", raw_title).strip()
    return pretty or None


def _clean_markdownish(text: str | None) -> str:
    if not text:
        return ""
    t = text
    t = re.sub(r"```[a-zA-Z0-9_-]*\n", "", t)
    t = t.replace("```", "")
    t = re.sub(r"!\[([^\]]*)\]\(([^)]*)\)", r"\1", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]*)\)", r"\1", t)
    t = re.sub(r"`([^`]*)`", r"\1", t)
    t = t.replace("`", "")
    t = t.replace("**", "")
    t = t.replace("__", "")
    t = re.sub(r"\*(\S[^*]*?)\*", r"\1", t)
    t = re.sub(r"_(\S[^_]*?)_", r"\1", t)
    t = t.replace("\r\n", "\n")
    t = re.sub(r"^\s*---+\s*$", "", t, flags=re.MULTILINE)
    t = re.sub(r"^\s*\|", "", t, flags=re.MULTILINE)
    t = re.sub(r"^\s*>\s?", "", t, flags=re.MULTILINE)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def _split_into_bullets(text: str | None) -> list[str]:
    cleaned = _clean_markdownish(text)
    if not cleaned:
        return []

    lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]
    list_items: list[str] = []
    for ln in lines:
        m = re.match(r"^(?:\*|\-|•)\s+(.+)$", ln)
        if m:
            list_items.append(m.group(1).strip())
            continue
        m = re.match(r"^(\d+)[\.|\)]\s+(.+)$", ln)
        if m:
            list_items.append(m.group(2).strip())
            continue

    if list_items:
        return list_items

    joined = " ".join(lines)
    parts = re.split(r"(?<=[\.!?])\s+|\s*;\s*|\s*\|\s*", joined)
    bullets = [p.strip().strip("-–• ") for p in parts if p and p.strip()]
    return bullets[:12]


def _is_meaningful_text(text: str | None) -> bool:
    cleaned = _clean_markdownish(text)
    if not cleaned:
        return False
    lowered = cleaned.strip().lower()
    if lowered in {"not available", "n/a", "none", "none identified", "processing...", "processing"}:
        return False
    return True


# ---------------------------------------------------------------------------
# Professional PDF generation using ReportLab Platypus
# ---------------------------------------------------------------------------

def _generate_analysis_pdf(output_path: Path, title: str, sections: list[tuple[str, str]]):
    """
    Generate a polished, business-grade Meeting Minutes PDF using ReportLab.

    Layout
    ------
    - Full-width dark navy cover band with layered opacity gradients,
      meeting title, generated date, and analyser info
    - One card per section: colored left-accent bar, bold heading, body content
    - Action Items rendered as checkbox list in a tinted green card
    - Footer on every page: document title + page number
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, KeepTogether,
    )
    from reportlab.platypus import Flowable
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    from zoneinfo import ZoneInfo

    # ── Palette ────────────────────────────────────────────────────────────
    NAVY        = colors.HexColor("#1B2A4A")
    ACCENT_BLUE = colors.HexColor("#2563EB")
    ACCENT_GREEN= colors.HexColor("#16A34A")
    ACCENT_AMBER= colors.HexColor("#D97706")
    LIGHT_GREY  = colors.HexColor("#F1F5F9")
    GREEN_BG    = colors.HexColor("#F0FDF4")
    AMBER_BG    = colors.HexColor("#FFFBEB")
    DIVIDER     = colors.HexColor("#E2E8F0")
    TEXT_DARK   = colors.HexColor("#1E293B")
    TEXT_MID    = colors.HexColor("#475569")
    TEXT_LIGHT  = colors.HexColor("#64748B")
    WHITE       = colors.white

    PAGE_W, PAGE_H = A4
    L_MARGIN = R_MARGIN = 18 * mm
    T_MARGIN = B_MARGIN = 18 * mm

    # ── Section accent colours map ─────────────────────────────────────────
    SECTION_THEME = {
        "summary":           (ACCENT_BLUE,  LIGHT_GREY),
        "business insights": (ACCENT_BLUE,  LIGHT_GREY),
        "technical insights":(colors.HexColor("#7C3AED"), colors.HexColor("#F5F3FF")),
        "action items":      (ACCENT_GREEN, GREEN_BG),
        "key topics":        (ACCENT_AMBER, AMBER_BG),
    }

    # ── Styles ─────────────────────────────────────────────────────────────
    def _style(name, **kw):
        defaults = dict(fontName="Helvetica", fontSize=11, leading=16,
                        textColor=TEXT_DARK, spaceAfter=0, spaceBefore=0)
        defaults.update(kw)
        return ParagraphStyle(name, **defaults)

    style_section_heading = _style("SectionHeading",
        fontName="Helvetica-Bold", fontSize=13, textColor=NAVY,
        leading=18, spaceBefore=2)
    style_body = _style("Body",
        fontName="Helvetica", fontSize=11, textColor=TEXT_DARK,
        leading=17, spaceAfter=3)
    style_bullet = _style("Bullet",
        fontName="Helvetica", fontSize=11, textColor=TEXT_DARK,
        leading=17, leftIndent=12, bulletIndent=0, spaceAfter=2)
    style_checkbox = _style("Checkbox",
        fontName="Helvetica-Bold", fontSize=11, textColor=colors.HexColor("#166534"),
        leading=17, leftIndent=12, bulletIndent=0, spaceAfter=2)
    style_footer = _style("Footer",
        fontName="Helvetica", fontSize=9, textColor=TEXT_LIGHT, leading=12)

    # ── Custom Flowable: Cover Header band ────────────────────────────────
    class CoverBand(Flowable):
        def __init__(self, meeting_title: str, width: float, gen_date: str):
            super().__init__()
            self._meeting_title = meeting_title
            self._gen_date = gen_date
            self.width = width
            self.height = 48 * mm

        def draw(self):
            c = self.canv
            w, h = self.width, self.height



            # Meeting title — large dark navy
            title_text = self._meeting_title or "Meeting"
            fs = 24 if len(title_text) <= 40 else (20 if len(title_text) <= 60 else 16)
            c.setFillColor(colors.HexColor("#1B2A4A"))
            c.setFont("Helvetica-Bold", fs)
            max_w = w
            while c.stringWidth(title_text, "Helvetica-Bold", fs) > max_w and len(title_text) > 4:
                title_text = title_text[:-2] + "..."
            c.drawString(0, h - 13 * mm, title_text)

            # "MEETING MINUTES" — small muted label below title
            c.setFillColor(colors.HexColor("#94A3B8"))
            c.setFont("Helvetica", 9)
            c.drawString(0, h - 19 * mm, "MEETING MINUTES")

            # Divider between title and metadata
            divider_y = h - 24 * mm
            c.setStrokeColor(colors.HexColor("#E2E8F0"))
            c.setLineWidth(0.5)
            c.line(0, divider_y, w, divider_y)

            # Metadata row
            meta_y = divider_y - 6 * mm

            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(colors.HexColor("#94A3B8"))
            c.drawString(0, meta_y, "DATE")
            c.setFont("Helvetica", 10)
            c.setFillColor(colors.HexColor("#1E293B"))
            c.drawString(0, meta_y - 5 * mm, self._gen_date)

            mid = w / 2
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(colors.HexColor("#94A3B8"))
            c.drawString(mid, meta_y, "ANALYSED BY")
            c.setFont("Helvetica", 10)
            c.setFillColor(colors.HexColor("#1E293B"))
            c.drawString(mid, meta_y - 5 * mm, "ASR Middleware System – Automated Analysis")

            # Bottom separator — solid navy bar matching the top
            # c.setFillColor(colors.HexColor("#1B2A4A"))
            # c.rect(0, 0, w, 2.5 * mm, fill=1, stroke=0)

    # ── Custom Flowable: Section Card ─────────────────────────────────────
    class SectionCard(Flowable):
        """
        Renders a section as a card with:
        - coloured left accent bar
        - bold heading
        - body content (bullets or paragraphs)
        """
        def __init__(self, heading: str, body_paras: list, accent: colors.Color,
                     bg: colors.Color, avail_width: float):
            super().__init__()
            self._heading = heading
            self._body_paras = body_paras
            self._accent = accent
            self._bg = bg
            self.width = avail_width
            self._padding = 8 * mm
            self._bar_w = 2

        def wrap(self, aW, aH):
            self._inner_w = self.width - self._bar_w - 2 * self._padding
            h = 6 * mm
            for p in self._body_paras:
                pw, ph = p.wrap(self._inner_w, 9999)
                h += ph + 2
            h += 2 * self._padding
            self.height = h
            return self.width, self.height

        def draw(self):
            c = self.canv
            w, h = self.width, self.height

            c.setFillColor(self._bg)
            c.roundRect(0, 0, w, h, 6, fill=1, stroke=0)

            c.setFillColor(self._accent)
            c.rect(0, 0, self._bar_w, h, fill=1, stroke=0)

            pad = self._padding
            inner_x = self._bar_w + pad
            y = h - pad - 5 * mm

            c.setFillColor(NAVY)
            c.setFont("Helvetica-Bold", 13)
            c.drawString(inner_x, y, self._heading.upper())

            y -= 4 * mm
            c.setStrokeColor(DIVIDER)
            c.setLineWidth(0.5)
            c.line(inner_x, y, w - pad, y)
            y -= 3 * mm

            inner_w = self._inner_w
            draw_y = y
            for p in self._body_paras:
                pw, ph = p.wrap(inner_w, 9999)
                p.drawOn(c, inner_x, draw_y - ph)
                draw_y -= ph + 2

    # ── Footer callback ────────────────────────────────────────────────────
    meeting_title_short = (title or "Meeting").strip()

    def _on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(TEXT_LIGHT)
        canvas.setFont("Helvetica", 9)
        footer_y = B_MARGIN - 6 * mm
        canvas.drawString(L_MARGIN, footer_y, meeting_title_short)
        canvas.drawRightString(PAGE_W - R_MARGIN, footer_y,
                               f"Page {doc.page}")
        canvas.setStrokeColor(DIVIDER)
        canvas.setLineWidth(0.5)
        canvas.line(L_MARGIN, footer_y + 5 * mm, PAGE_W - R_MARGIN, footer_y + 5 * mm)
        canvas.restoreState()

    # ── Build story ────────────────────────────────────────────────────────
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=L_MARGIN,
        rightMargin=R_MARGIN,
        topMargin=T_MARGIN,
        bottomMargin=B_MARGIN + 8 * mm,
        title=meeting_title_short,
        author="ASR Middleware System",
    )

    avail_w = PAGE_W - L_MARGIN - R_MARGIN
    story = []

    # 1. Compute generation date (used both in header and story)
    try:
        dhaka_now = datetime.now(tz=ZoneInfo("Asia/Dhaka"))
        gen_date = dhaka_now.strftime("%B %d, %Y  %I:%M %p")
    except Exception:
        gen_date = datetime.utcnow().strftime("%B %d, %Y  %I:%M %p")

    # 2. Cover band — now includes date + analyser
    story.append(CoverBand(title or "Meeting", avail_w, gen_date))
    story.append(Spacer(1, 6 * mm))

    # 3. Section cards
    any_section = False
    for heading, body in sections:
        if not _is_meaningful_text(body):
            continue
        any_section = True

        key = heading.strip().lower()
        accent, bg = SECTION_THEME.get(key, (ACCENT_BLUE, LIGHT_GREY))
        is_action = key == "action items"

        body_paras = []
        bullets = _split_into_bullets(body)
        if bullets:
            for b in bullets:
                if is_action:
                    body_paras.append(
                        Paragraph(f"&#9744; &nbsp;{b}", style_checkbox)
                    )
                else:
                    body_paras.append(
                        Paragraph(f"&#8226; &nbsp;{b}", style_bullet)
                    )
        else:
            cleaned = _clean_markdownish(body)
            for line in cleaned.split("\n"):
                line = line.strip()
                if not line:
                    body_paras.append(Spacer(1, 3 * mm))
                else:
                    body_paras.append(Paragraph(line, style_body))

        if not body_paras:
            body_paras.append(Paragraph("No details available.", style_body))

        card = SectionCard(
            heading=heading,
            body_paras=body_paras,
            accent=accent,
            bg=bg,
            avail_width=avail_w,
        )
        story.append(KeepTogether([card, Spacer(1, 5 * mm)]))

    if not any_section:
        story.append(Paragraph("No analysis content available.", style_body))

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)


# Maximum time (in seconds) to wait for Gemini file processing before giving up
_GEMINI_POLL_TIMEOUT = 120
_GEMINI_POLL_INTERVAL = 2

load_dotenv()

# Setup Sync DB Connection for the Worker
engine = create_engine(os.getenv("SYNC_DATABASE_URL"))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

logger = get_task_logger(__name__)


@celery_app.task(name="task_transcribe_audio")
def task_transcribe_audio(audio_id: str, file_path: str, mime_type: str):
    db = SessionLocal()

    try:
        logger.info(f"Starting Gemini processing for audio_id: {audio_id}")
        with open(file_path, 'rb') as f:
            audio_file = client.files.upload(file=f, config={'mime_type': mime_type})

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

        audio_record = db.query(AudioTranscription).filter(AudioTranscription.id == uuid.UUID(audio_id)).first()
        if audio_record:
            audio_record.transcription_text = response.text
            db.commit()
            logger.info(f"SUCCESS: Database updated for {audio_id}")
        else:
            logger.error(f"FAIL: Could not find record {audio_id} in the database!")

        client.files.delete(name=audio_file.name)

    except Exception as e:
        db.rollback()
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


@celery_app.task(name="task_analyze_meeting", bind=True)
def task_analyze_meeting(self, analysis_id: str, audio_translation_id: str, generate_markdown: bool):
    db = SessionLocal()
    try:
        logger.info(f"Starting analysis for analysis_id: {analysis_id}")

        translation = db.query(AudioTranslation).filter(
            AudioTranslation.id == uuid.UUID(audio_translation_id)
        ).first()

        if not translation or not translation.translated_text:
            logger.error(f"Translation {audio_translation_id} not found or empty.")
            return

        content_text = translation.translated_text

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

        def extract_section(text: str, section_name: str) -> str:
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
            analysis_record.content_text = content_text

            db.commit()

            try:
                folder_name = analysis_record.task_id or getattr(self.request, "id", None) or translation.task_id or analysis_id
                rel_pdf_path = f"{folder_name}/analysis.pdf"
                abs_pdf_path = MEDIA_DIR / rel_pdf_path

                meeting_title = getattr(analysis_record, "meeting_title", None) or None

                if not meeting_title:
                    try:
                        audio_rec = (
                            db.query(AudioTranscription)
                            .filter(AudioTranscription.id == translation.audio_transcription_id)
                            .first()
                        )
                        meeting_title = _derive_meeting_title_from_filename(getattr(audio_rec, "filename", None))
                    except Exception:
                        meeting_title = None

                meeting_title = meeting_title or "Meeting Analysis"

                _generate_analysis_pdf(
                    abs_pdf_path,
                    title=meeting_title,
                    sections=[
                        ("Summary", summary),
                        ("Business Insights", business_insights),
                        ("Technical Insights", technical_insights),
                        ("Action Items", action_items),
                        ("Key Topics", key_topics),
                    ],
                )

                analysis_record.pdf_path = rel_pdf_path
                db.commit()
                logger.info(f"SUCCESS: Analysis {analysis_id} updated and PDF generated.")
            except Exception as pdf_err:
                db.rollback()
                logger.warning(f"PDF generation failed for analysis_id={analysis_id}: {pdf_err}")

    except Exception as e:
        db.rollback()
        logger.error(f"Analysis Task Failed: {str(e)}")
        raise e
    finally:
        db.close()


@celery_app.task(name="task_full_meeting_pipeline", bind=True)
def task_full_meeting_pipeline(self, audio_id: str, translation_id: str, analysis_id: str, file_path: str, mime_type: str, generate_markdown: bool):
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

        confidence = 0.85
        translated_text = full_translate_text
        conf_match = re.search(r'Confidence:\s*([0-9]*\.?[0-9]+)', full_translate_text, re.IGNORECASE)
        if conf_match:
            confidence = float(conf_match.group(1))
            translated_text = re.sub(r'\n?Confidence:.*$', '', full_translate_text, flags=re.IGNORECASE).strip()

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

        # Generate PDF
        try:
            folder_name = analysis_rec.task_id or getattr(self.request, "id", None) or audio_rec.task_id or translation_id
            rel_pdf_path = f"{folder_name}/analysis.pdf"
            abs_pdf_path = MEDIA_DIR / rel_pdf_path

            meeting_title = getattr(analysis_rec, "meeting_title", None) or None

            if not meeting_title:
                meeting_title = _derive_meeting_title_from_filename(getattr(audio_rec, "filename", None))

            meeting_title = meeting_title or "Meeting Analysis"

            _generate_analysis_pdf(
                abs_pdf_path,
                title=meeting_title,
                sections=[
                    ("Summary", summary),
                    ("Business Insights", business_insights),
                    ("Technical Insights", technical_insights),
                    ("Action Items", action_items),
                    ("Key Topics", key_topics),
                ],
            )

            analysis_rec.pdf_path = rel_pdf_path
            db.commit()
        except Exception as pdf_err:
            db.rollback()
            logger.warning(f"PDF generation failed for pipeline task_id={getattr(self.request, 'id', None)}: {pdf_err}")

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