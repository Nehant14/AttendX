"""
Tests for Session API endpoints (Capture -> Review -> Resolve -> Finalize -> Audit):
  - Session photo upload & creation
  - Status polling
  - Review response payload (faces, not_detected list, summary)
  - Resolve actions (confirm, reject with reassign, reject without reassign, state conflicts)
  - Finalization logic (converting unresolved flagged/not_detected to absent)
  - Session audit trail retrieval
"""
from datetime import date

import numpy as np
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import (
    AttendanceRecord,
    ClassModel,
    ClassRoster,
    ClassSession,
    DetectedFace,
    Professor,
    Student,
    StudentEmbedding,
)
from app.ml.detector import Face
from tests.conftest import create_synthetic_image_bytes, create_unit_embedding


@pytest.mark.asyncio
async def test_create_session_success(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    mock_detector,
    tmp_storage: str,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "USE_CELERY", False)

    # Setup class roster & embeddings
    db_session.add(ClassRoster(class_id=test_class.id, student_id=test_student.id))
    emb = create_unit_embedding(1)
    db_session.add(StudentEmbedding(student_id=test_student.id, embedding=emb, model_version="v1"))
    await db_session.commit()

    face = Face(bbox=(10, 10, 50, 50), det_score=0.95, embedding=np.array(emb, dtype=np.float32))
    mock_detector(faces=[face])

    photo_bytes = create_synthetic_image_bytes()
    files = {"photo": ("classroom.jpg", photo_bytes, "image/jpeg")}
    data = {"class_id": str(test_class.id)}

    response = await client.post("/sessions", data=data, files=files, headers=auth_headers)
    assert response.status_code == 201
    res_data = response.json()
    assert "session_id" in res_data
    assert res_data["status"] == "reviewed"


@pytest.mark.asyncio
async def test_create_session_class_not_found(
    client: AsyncClient, auth_headers: dict[str, str], sample_jpeg_bytes: bytes
):
    files = {"photo": ("classroom.jpg", sample_jpeg_bytes, "image/jpeg")}
    data = {"class_id": "999999"}

    response = await client.post("/sessions", data=data, files=files, headers=auth_headers)
    assert response.status_code == 404
    assert "Class not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_session_status(
    client: AsyncClient, auth_headers: dict[str, str], test_class: ClassModel, db_session: AsyncSession
):
    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/p.jpg", status="pending")
    db_session.add(session)
    await db_session.commit()

    response = await client.get(f"/sessions/{session.id}/status", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"session_id": session.id, "status": "pending", "error_detail": None}


@pytest.mark.asyncio
async def test_review_session_not_ready_conflict(
    client: AsyncClient, auth_headers: dict[str, str], test_class: ClassModel, db_session: AsyncSession
):
    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/p.jpg", status="pending")
    db_session.add(session)
    await db_session.commit()

    response = await client.get(f"/sessions/{session.id}/review", headers=auth_headers)
    assert response.status_code == 409
    assert "Session is not ready for review" in response.json()["detail"]


@pytest.mark.asyncio
async def test_review_session_success(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/photo.jpg", status="reviewed")
    db_session.add(session)
    await db_session.flush()

    face = DetectedFace(
        session_id=session.id,
        bbox_x=10.0,
        bbox_y=10.0,
        bbox_width=40.0,
        bbox_height=40.0,
        det_score=0.9,
        quality_passed=True,
        matched_student_id=test_student.id,
        match_score=0.85,
        classification="flagged",
    )
    rec = AttendanceRecord(
        session_id=session.id,
        student_id=test_student.id,
        status="flagged",
        confidence_score=0.85,
    )
    db_session.add_all([face, rec])
    await db_session.commit()

    response = await client.get(f"/sessions/{session.id}/review", headers=auth_headers)
    assert response.status_code == 200
    res = response.json()
    assert res["session_id"] == session.id
    assert len(res["faces"]) == 1
    assert res["faces"][0]["classification"] == "flagged"
    assert res["faces"][0]["matched_student_name"] == test_student.name
    assert res["summary"]["flagged"] == 1


@pytest.mark.asyncio
async def test_resolve_face_confirm(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/p.jpg", status="reviewed")
    db_session.add(session)
    await db_session.flush()

    face = DetectedFace(
        session_id=session.id,
        bbox_x=0.0, bbox_y=0.0, bbox_width=10.0, bbox_height=10.0,
        matched_student_id=test_student.id,
        classification="flagged",
        match_score=0.55,
    )
    rec = AttendanceRecord(session_id=session.id, student_id=test_student.id, status="flagged")
    db_session.add_all([face, rec])
    await db_session.commit()

    payload = {"detected_face_id": face.id, "action": "confirm"}
    response = await client.post(f"/sessions/{session.id}/resolve", json=payload, headers=auth_headers)
    assert response.status_code == 200
    res = response.json()
    assert res["classification"] == "present"
    assert res["matched_student_id"] == test_student.id

    await db_session.refresh(rec)
    assert rec.status == "present"
    assert rec.reviewed_by_professor is True


@pytest.mark.asyncio
async def test_resolve_face_reject_and_reassign(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    student2 = Student(roll_no="STU002", name="Actual Student")
    db_session.add(student2)
    await db_session.flush()

    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/p.jpg", status="reviewed")
    db_session.add(session)
    await db_session.flush()

    face = DetectedFace(
        session_id=session.id,
        bbox_x=0.0, bbox_y=0.0, bbox_width=10.0, bbox_height=10.0,
        matched_student_id=test_student.id,
        classification="flagged",
    )
    rec1 = AttendanceRecord(session_id=session.id, student_id=test_student.id, status="flagged")
    rec2 = AttendanceRecord(session_id=session.id, student_id=student2.id, status="not_detected")
    db_session.add_all([face, rec1, rec2])
    await db_session.commit()

    payload = {
        "detected_face_id": face.id,
        "action": "reject",
        "reassign_student_id": student2.id,
    }
    response = await client.post(f"/sessions/{session.id}/resolve", json=payload, headers=auth_headers)
    assert response.status_code == 200
    res = response.json()
    assert res["classification"] == "present"
    assert res["matched_student_id"] == student2.id

    await db_session.refresh(rec1)
    await db_session.refresh(rec2)
    assert rec1.status == "not_detected"
    assert rec2.status == "present"


@pytest.mark.asyncio
async def test_finalize_session_success(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    test_student: Student,
    db_session: AsyncSession,
):
    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/p.jpg", status="reviewed")
    db_session.add(session)
    await db_session.flush()

    s_absent = Student(roll_no="ABSENT01", name="Absent Student")
    db_session.add(s_absent)
    await db_session.flush()

    rec_present = AttendanceRecord(session_id=session.id, student_id=test_student.id, status="present")
    rec_not_detected = AttendanceRecord(session_id=session.id, student_id=s_absent.id, status="not_detected")
    db_session.add_all([rec_present, rec_not_detected])
    await db_session.commit()

    response = await client.post(f"/sessions/{session.id}/finalize", headers=auth_headers)
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "finalized"
    assert res["present_count"] == 1
    assert res["absent_count"] == 1

    await db_session.refresh(rec_not_detected)
    assert rec_not_detected.status == "absent"


@pytest.mark.asyncio
async def test_get_audit_log(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_class: ClassModel,
    db_session: AsyncSession,
):
    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/p.jpg", status="reviewed")
    db_session.add(session)
    await db_session.commit()

    await client.post(f"/sessions/{session.id}/finalize", headers=auth_headers)

    response = await client.get(f"/sessions/{session.id}/audit", headers=auth_headers)
    assert response.status_code == 200
    logs = response.json()
    assert len(logs) >= 1
    assert logs[-1]["action"] == "finalized"
