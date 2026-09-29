"""
Celery task(s) for background processing of session photos, so the
mobile app isn't blocked waiting on inference (Phase/Milestone M11 in
the plan). Only used when settings.USE_CELERY is True; otherwise
app/api/sessions.py calls process_session() synchronously inline.
"""
import asyncio

from celery import Celery

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.services.attendance_service import process_session

celery_app = Celery(
    "attendance_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


def _run_async(coro):
    """Celery workers run sync; bridge into the async DB session/session
    service each task needs."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _process_session_async(session_id: int) -> None:
    async with AsyncSessionLocal() as db:
        await process_session(db, session_id)


@celery_app.task(name="process_session_task", bind=True, max_retries=2, default_retry_delay=10)
def process_session_task(self, session_id: int) -> str:
    try:
        _run_async(_process_session_async(session_id))
        return f"session {session_id} processed"
    except Exception as exc:  # noqa: BLE001
        raise self.retry(exc=exc)
