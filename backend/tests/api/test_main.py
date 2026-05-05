from dataclasses import dataclass
from pathlib import Path

from fastapi.testclient import TestClient

from app.api.main import app
from app.api.v1.deps import get_current_active_user


@dataclass
class _FakeUser:
	id: str = "user-1"
	is_active: bool = True
	is_superuser: bool = False


def test_email_send_endpoint_queues_payload(monkeypatch):
	app.dependency_overrides[get_current_active_user] = lambda: _FakeUser()

	captured = {}

	class _FakeResult:
		id = "task-123"

	def fake_delay(payload):
		captured["payload"] = payload
		return _FakeResult()

	monkeypatch.setattr("app.worker.tasks.task_send_smtp_email.delay", fake_delay)

	client = TestClient(app)
	response = client.post(
		"/api/v1/emails/send",
		json={
			"to": "recipient@example.com",
			"cc": "copy@example.com,copy2@example.com",
			"subject": "Status update",
			"body": "Hello from the API",
			"task_id": "task-123",
		},
	)

	app.dependency_overrides.clear()

	assert response.status_code == 200
	assert response.json() == {"task_id": "task-123", "status": "queued"}
	assert captured["payload"]["to"] == "recipient@example.com"
	assert captured["payload"]["cc"] == "copy@example.com,copy2@example.com"
	assert captured["payload"]["body"] == "Hello from the API"
	assert captured["payload"]["task_id"] == "task-123"


def test_task_send_smtp_email_uses_mail_env(monkeypatch):
	from app.worker import tasks

	sent = {}

	class FakeSMTP:
		def __init__(self, host, port):
			sent["host"] = host
			sent["port"] = port
			sent["tls_started"] = False
			sent["logged_in"] = None
			sent["message"] = None

		def ehlo(self):
			return None

		def starttls(self, context=None):
			sent["tls_started"] = True

		def login(self, user, password):
			sent["logged_in"] = (user, password)

		def send_message(self, message, to_addrs=None):
			sent["message"] = message
			sent["to_addrs"] = list(to_addrs or [])

		def quit(self):
			sent["quit"] = True

	monkeypatch.setenv("MAIL_HOST", "smtp.example.com")
	monkeypatch.setenv("MAIL_PORT", "587")
	monkeypatch.setenv("MAIL_USERNAME", "sender@example.com")
	monkeypatch.setenv("MAIL_PASSWORD", "secret")
	monkeypatch.setenv("MAIL_ENCRYPTION", "tls")
	monkeypatch.setenv("MAIL_FROM_ADDRESS", "sender@example.com")
	monkeypatch.setenv("MAIL_FROM_NAME", "ASR Middleware")
	monkeypatch.setattr(tasks.smtplib, "SMTP", FakeSMTP)
	monkeypatch.setattr(tasks.smtplib, "SMTP_SSL", FakeSMTP)

	result = tasks.task_send_smtp_email(
		{
			"to": "recipient@example.com",
			"cc": "copy@example.com",
			"subject": "Hello",
			"body": "Plain text body",
		}
	)

	assert result == {
		"sent": True,
		"recipients": ["recipient@example.com", "copy@example.com"],
	}
	assert sent["host"] == "smtp.example.com"
	assert sent["port"] == 587
	assert sent["tls_started"] is True
	assert sent["logged_in"] == ("sender@example.com", "secret")
	assert sent["to_addrs"] == ["recipient@example.com", "copy@example.com"]
	assert sent["message"]["Subject"] == "Hello"


def test_task_send_smtp_email_attaches_analysis_pdf(monkeypatch, tmp_path):
	from app.worker import tasks

	media_root = tmp_path / "media"
	task_dir = media_root / "task-999"
	task_dir.mkdir(parents=True)
	pdf_bytes = b"%PDF-1.4\n%test pdf\n"
	(task_dir / "analysis.pdf").write_bytes(pdf_bytes)

	monkeypatch.setattr(tasks, "_MEDIA_DIR", media_root)
	monkeypatch.setenv("MAIL_HOST", "smtp.example.com")
	monkeypatch.setenv("MAIL_PORT", "587")
	monkeypatch.setenv("MAIL_USERNAME", "sender@example.com")
	monkeypatch.setenv("MAIL_PASSWORD", "secret")
	monkeypatch.setenv("MAIL_ENCRYPTION", "tls")
	monkeypatch.setenv("MAIL_FROM_ADDRESS", "sender@example.com")
	monkeypatch.setenv("MAIL_FROM_NAME", "ASR Middleware")

	sent = {}

	class FakeSMTP:
		def __init__(self, host, port):
			sent["host"] = host
			sent["port"] = port

		def ehlo(self):
			return None

		def starttls(self, context=None):
			sent["tls_started"] = True

		def login(self, user, password):
			sent["logged_in"] = (user, password)

		def send_message(self, message, to_addrs=None):
			sent["message"] = message
			sent["to_addrs"] = list(to_addrs or [])

		def quit(self):
			sent["quit"] = True

	monkeypatch.setattr(tasks.smtplib, "SMTP", FakeSMTP)
	monkeypatch.setattr(tasks.smtplib, "SMTP_SSL", FakeSMTP)

	result = tasks.task_send_smtp_email(
		{
			"to": "recipient@example.com",
			"subject": "Meeting summary",
			"body": "See attached",
			"task_id": "task-999",
		}
	)

	assert result == {"sent": True, "recipients": ["recipient@example.com"]}
	attachments = list(sent["message"].iter_attachments())
	assert len(attachments) == 1
	assert attachments[0].get_filename() == "analysis.pdf"
	assert attachments[0].get_content_type() == "application/pdf"
	assert attachments[0].get_payload(decode=True) == pdf_bytes
