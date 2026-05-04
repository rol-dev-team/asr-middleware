from fastapi import APIRouter, Depends
from typing import Annotated

from app.api.models import EmailQueuedResponse, EmailSendRequest, User
from app.api.v1.deps import get_current_active_user


router = APIRouter(
    prefix="/emails",
    tags=["emails"],
)


@router.post("/send", response_model=EmailQueuedResponse)
async def enqueue_email(
    payload: EmailSendRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    # current_user is intentionally unused; it acts as an auth guard
    # to prevent this endpoint from becoming an open relay.
    from app.worker.tasks import task_send_smtp_email
    celery_result = task_send_smtp_email.delay(payload.model_dump())
    return EmailQueuedResponse(task_id=celery_result.id)
