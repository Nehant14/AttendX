"""
Tests for the endpoints/guards added while integrating the mobile app:

  - GET /classes            (list, scoped to the professor)
  - GET /students           (list)
  - GET /sessions           (history with counts, optional class filter, scoped)
  - POST /sessions/{id}/resolve guards (confirm with no student, reassign to
    a student who is not on the class roster)
  - POST /sessions when processing fails in synchronous mode (no HTTP 500)
"""
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.models import (
    AttendanceRecord,
    ClassModel,
    ClassRoster,
    ClassSession,
    DetectedFace,
    Professor,
    Student,
)
from tests.conftest import create_synthetic_image_bytes


async def _make_session(db: AsyncSession, class_id: int, status: str = "reviewed") -> ClassSession:
    session = ClassSession(class_id=class_id, session_date=date.today(), photo_path="/tmp/p.jpg", status=status)
    db.add(session)
    await db.flush()
    return session


# ---------------------------------------------------------------- classes
@pytest.mark.asyncio
async def test_list_classes_requires_auth(client: AsyncClient):
    assert (await client.get("/classes")).status_code == 401


@pytest.mark.asyncio
async def test_list_classes_only_returns_own_classes_newest_first(
    client: AsyncClient, auth_headers: dict[str, str], test_professor: Professor, db_session: AsyncSession
):
    other = Professor(name="Other", email="other@x.edu", password_hash=hash_password("secret123"))
    db_session.add(other)
    await db_session.flush()
    db_session.add_all([
        ClassModel(name="First", professor_id=test_professor.id),
        ClassModel(name="Second", professor_id=test_professor.id),
        ClassModel(name="Not mine", professor_id=other.id),
    ])
    await db_session.commit()

    res = await client.get("/classes", headers=auth_headers)
    assert res.status_code == 200
    names = [c["name"] for c in res.json()]
    assert names == ["Second", "First"]


# --------------------------------------------------------------- students
@pytest.mark.asyncio
async def test_list_students(client: AsyncClient, auth_headers: dict[str, str], db_session: AsyncSession):
    assert (await client.get("/students")).status_code == 401

    assert (await client.get("/students", headers=auth_headers)).json() == []
    db_session.add_all([Student(roll_no="A1", name="Ann"), Student(roll_no="B2", name="Bo")])
    await db_session.commit()

    res = await client.get("/students", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert [s["roll_no"] for s in body] == ["B2", "A1"]
    assert set(body[0]) == {"id", "roll_no", "name", "created_at"}


# --------------------------------------------------------------- sessions
@pytest.mark.asyncio
async def test_list_sessions_with_counts_and_filters(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_professor: Professor,
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    other_class = ClassModel(name="Second class", professor_id=test_professor.id)
    db_session.add(other_class)
    await db_session.flush()
    s2 = Student(roll_no="STU002", name="Second")
    db_session.add(s2)
    await db_session.flush()

    done = await _make_session(db_session, test_class.id, "finalized")
    pending = await _make_session(db_session, other_class.id, "pending")
    db_session.add_all([
        AttendanceRecord(session_id=done.id, student_id=test_student.id, status="present"),
        AttendanceRecord(session_id=done.id, student_id=s2.id, status="absent"),
    ])
    await db_session.commit()

    res = await client.get("/sessions", headers=auth_headers)
    assert res.status_code == 200
    rows = res.json()
    assert [r["id"] for r in rows] == [pending.id, done.id]  # newest first

    by_id = {r["id"]: r for r in rows}
    assert by_id[done.id]["present_count"] == 1
    assert by_id[done.id]["absent_count"] == 1
    assert by_id[done.id]["class_name"] == test_class.name
    assert by_id[pending.id]["present_count"] == 0

    filtered = await client.get("/sessions", params={"class_id": test_class.id}, headers=auth_headers)
    assert [r["id"] for r in filtered.json()] == [done.id]

    limited = await client.get("/sessions", params={"limit": 1}, headers=auth_headers)
    assert len(limited.json()) == 1


@pytest.mark.asyncio
async def test_list_sessions_is_scoped_to_professor(
    client: AsyncClient, auth_headers: dict[str, str], db_session: AsyncSession
):
    other = Professor(name="Other", email="other2@x.edu", password_hash=hash_password("secret123"))
    db_session.add(other)
    await db_session.flush()
    other_class = ClassModel(name="Theirs", professor_id=other.id)
    db_session.add(other_class)
    await db_session.flush()
    await _make_session(db_session, other_class.id)
    await db_session.commit()

    res = await client.get("/sessions", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.asyncio
async def test_list_sessions_requires_auth(client: AsyncClient):
    assert (await client.get("/sessions")).status_code == 401


# ---------------------------------------------------------- resolve guards
@pytest.mark.asyncio
async def test_confirm_face_without_matched_student_is_rejected(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    db_session: AsyncSession,
):
    session = await _make_session(db_session, test_class.id)
    face = DetectedFace(
        session_id=session.id, bbox_x=0, bbox_y=0, bbox_width=10, bbox_height=10,
        matched_student_id=None, classification="unmatched",
    )
    db_session.add(face)
    await db_session.commit()

    res = await client.post(
        f"/sessions/{session.id}/resolve",
        json={"detected_face_id": face.id, "action": "confirm"},
        headers=auth_headers,
    )
    assert res.status_code == 400
    assert "no matched student" in res.json()["detail"].lower()

    await db_session.refresh(face)
    assert face.classification == "unmatched"


@pytest.mark.asyncio
async def test_reassign_to_student_not_on_roster_is_rejected(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    outsider = Student(roll_no="OUT1", name="Not on roster")
    db_session.add(outsider)
    db_session.add(ClassRoster(class_id=test_class.id, student_id=test_student.id))
    await db_session.flush()

    session = await _make_session(db_session, test_class.id)
    face = DetectedFace(
        session_id=session.id, bbox_x=0, bbox_y=0, bbox_width=10, bbox_height=10,
        matched_student_id=test_student.id, classification="flagged",
    )
    db_session.add(face)
    await db_session.commit()

    res = await client.post(
        f"/sessions/{session.id}/resolve",
        json={"detected_face_id": face.id, "action": "reject", "reassign_student_id": outsider.id},
        headers=auth_headers,
    )
    assert res.status_code == 400
    assert "roster" in res.json()["detail"].lower()

    await db_session.refresh(face)
    assert face.matched_student_id == test_student.id  # untouched


@pytest.mark.asyncio
async def test_resolve_with_unknown_action_is_400(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    session = await _make_session(db_session, test_class.id)
    face = DetectedFace(
        session_id=session.id, bbox_x=0, bbox_y=0, bbox_width=10, bbox_height=10,
        matched_student_id=test_student.id, classification="flagged",
    )
    db_session.add(face)
    await db_session.commit()

    res = await client.post(
        f"/sessions/{session.id}/resolve",
        json={"detected_face_id": face.id, "action": "explode"},
        headers=auth_headers,
    )
    assert res.status_code == 400


# --------------------------------------------------- sync failure handling
@pytest.mark.asyncio
async def test_create_session_sync_failure_returns_201_with_failed_status(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    mock_detector,
    tmp_storage: str,
    monkeypatch: pytest.MonkeyPatch,
):
    """Empty roster => pipeline raises. The upload itself succeeded, so the
    API should report the failed session rather than an HTTP 500."""
    monkeypatch.setattr(settings, "USE_CELERY", False)
    mock_detector(faces=[])

    res = await client.post(
        "/sessions",
        data={"class_id": str(test_class.id)},
        files={"photo": ("class.jpg", create_synthetic_image_bytes(), "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "failed"

    status_res = await client.get(f"/sessions/{body['session_id']}/status", headers=auth_headers)
    assert status_res.json()["status"] == "failed"
    assert "roster" in status_res.json()["error_detail"].lower()
