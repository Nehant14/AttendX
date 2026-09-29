"""
Tests for Celery Worker & Background Processing Tasks (app/workers/tasks.py):
  - Celery application configuration & serialization
  - Sync-to-Async bridge helper (_run_async)
  - process_session_task execution and exception retry handling
"""
import pytest
from unittest.mock import MagicMock

from app.workers.tasks import _run_async, celery_app, process_session_task


def test_celery_app_config():
    assert celery_app.main == "attendance_worker"
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.timezone == "UTC"


def test_run_async_helper():
    async def sample_coro():
        return 42

    result = _run_async(sample_coro())
    assert result == 42


def test_process_session_task_success(monkeypatch: pytest.MonkeyPatch):
    called = []

    def mock_run_async(coro):
        called.append(True)
        return None

    monkeypatch.setattr("app.workers.tasks._run_async", mock_run_async)

    result = process_session_task(session_id=123)
    assert result == "session 123 processed"
    assert len(called) == 1


def test_process_session_task_retry_on_exception(monkeypatch: pytest.MonkeyPatch):
    def mock_run_async_error(coro):
        raise ValueError("Database connection lost")

    monkeypatch.setattr("app.workers.tasks._run_async", mock_run_async_error)

    task_mock = MagicMock()
    task_mock.retry.side_effect = RuntimeError("RetryTriggered")

    with pytest.raises(RuntimeError, match="RetryTriggered"):
        process_session_task.__wrapped__(task_mock, 456)

    task_mock.retry.assert_called_once()
