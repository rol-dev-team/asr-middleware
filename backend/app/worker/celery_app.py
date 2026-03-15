import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "asr_middleware",
    broker=REDIS_URL,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_track_started=True,
    task_ignore_result=True,
    task_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry=True,            # retry on dropped connections
    broker_connection_retry_on_startup=True, # retry until Redis is ready
    broker_connection_max_retries=5,
    broker_transport_options={
        "socket_connect_timeout": 10,        # more breathing room
        "socket_timeout": 10,
        "retry_on_timeout": True,
    },
)