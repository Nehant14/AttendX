"""
Tests for Core Attendance Business Logic (app/services/attendance_service.py):
  - Roster embedding loader (_load_roster_embeddings)
  - Face crop file saver (_save_crop)
  - Full session processing pipeline (process_session)
  - Error paths: empty roster, unreadable image, unexpected exceptions, rollback behavior
"""
import os
from datetime import date

import cv2
import numpy as np
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AttendanceRecord,
    AuditLog,
    ClassModel,
    ClassRoster,
    ClassSession,
    DetectedFace,
    Student,
    StudentEmbedding,
)
from app.ml.detector import Face
from app.services.attendance_service import (
    ProcessingError,
    _load_roster_embeddings,
    _save_crop,
    process_session,
)
from tests.conftest import create_synthetic_image_bytes, create_unit_embedding


@pytest.mark.asyncio
async def test_load_roster_embeddings_empty_roster(db_session: AsyncSession, test_class: ClassModel):
    students, embeddings = await _load_roster_embeddings(db_session, test_class.id)
    assert students == {}
    assert embeddings == {}


@pytest.mark.asyncio
async def test_load_roster_embeddings_with_students(
    db_session: AsyncSession, test_class: ClassModel, test_student: Student
):
    # Link student to class roster
    db_session.add(ClassRoster(class_id=test_class.id, student_id=test_student.id))
    # Add embedding vector
    vec = create_unit_embedding(1)
    db_session.add(
        StudentEmbedding(student_id=test_student.id, embedding=vec, model_version="v1")
    )
    await db_session.commit()

    students, embeddings = await _load_roster_embeddings(db_session, test_class.id)
    assert test_student.id in students
    assert len(embeddings[test_student.id]) == 1
    assert isinstance(embeddings[test_student.id][0], np.ndarray)


def test_save_crop(tmp_storage: str):
    img = np.zeros((50, 50, 3), dtype=np.uint8)
    crop_path = _save_crop(img, session_id=10, index=0)
    assert os.path.exists(crop_path)
    assert "session10_face0_" in os.path.basename(crop_path)


@pytest.mark.asyncio
async def test_process_session_nonexistent_id(db_session: AsyncSession):
    with pytest.raises(ProcessingError, match="Session 999999 not found"):
        await process_session(db_session, session_id=999999)


@pytest.mark.asyncio
async def test_process_session_empty_roster(
    db_session: AsyncSession, test_class: ClassModel, tmp_storage: str
):
    # Save a valid image file
    img_path = os.path.join(tmp_storage, "test_session.jpg")
    cv2.imwrite(img_path, np.zeros((100, 100, 3), dtype=np.uint8))

    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path=img_path)
    db_session.add(session)
    await db_session.commit()

    with pytest.raises(ProcessingError, match="Class roster is empty"):
        await process_session(db_session, session.id)

    await db_session.refresh(session)
    assert session.status == "failed"
    assert "Class roster is empty" in session.error_detail


@pytest.mark.asyncio
async def test_process_session_unreadable_photo(
    db_session: AsyncSession, test_class: ClassModel, test_student: Student, tmp_storage: str
):
    db_session.add(ClassRoster(class_id=test_class.id, student_id=test_student.id))
    session = ClassSession(
        class_id=test_class.id, session_date=date.today(), photo_path="/nonexistent/photo.jpg"
    )
    db_session.add(session)
    await db_session.commit()

    with pytest.raises(ProcessingError, match="Could not read photo"):
        await process_session(db_session, session.id)

    await db_session.refresh(session)
    assert session.status == "failed"


@pytest.mark.asyncio
async def test_process_session_happy_path(
    db_session: AsyncSession,
    test_class: ClassModel,
    mock_detector,
    tmp_storage: str,
):
    # Create 2 students: Alice (in photo) and Bob (absent/not detected)
    s_alice = Student(roll_no="ALICE01", name="Alice")
    s_bob = Student(roll_no="BOB02", name="Bob")
    db_session.add_all([s_alice, s_bob])
    await db_session.flush()

    db_session.add_all([
        ClassRoster(class_id=test_class.id, student_id=s_alice.id),
        ClassRoster(class_id=test_class.id, student_id=s_bob.id),
    ])

    emb_alice = np.array(create_unit_embedding(100), dtype=np.float32)
    emb_bob = np.array(create_unit_embedding(200), dtype=np.float32)

    db_session.add(StudentEmbedding(student_id=s_alice.id, embedding=emb_alice.tolist(), model_version="v1"))
    db_session.add(StudentEmbedding(student_id=s_bob.id, embedding=emb_bob.tolist(), model_version="v1"))
    await db_session.commit()

    # Image photo containing 1 face matching Alice perfectly
    img_path = os.path.join(tmp_storage, "session_photo.jpg")
    synthetic_img = np.zeros((300, 300, 3), dtype=np.uint8)
    synthetic_img[::2, ::2] = 255  # Pass sharpness check
    cv2.imwrite(img_path, synthetic_img)

    face_alice = Face(bbox=(30, 30, 80, 80), det_score=0.96, embedding=emb_alice)
    mock_detector(faces=[face_alice])

    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path=img_path)
    db_session.add(session)
    await db_session.commit()

    # Run processing
    await process_session(db_session, session.id)

    await db_session.refresh(session)
    assert session.status == "reviewed"
    assert session.error_detail is None

    # Verify DetectedFace row
    faces_res = await db_session.execute(
        select(DetectedFace).where(DetectedFace.session_id == session.id)
    )
    faces = faces_res.scalars().all()
    assert len(faces) == 1
    assert faces[0].matched_student_id == s_alice.id
    assert faces[0].classification == "present"

    # Verify AttendanceRecord rows
    recs_res = await db_session.execute(
        select(AttendanceRecord).where(AttendanceRecord.session_id == session.id)
    )
    recs = {r.student_id: r for r in recs_res.scalars().all()}
    assert recs[s_alice.id].status == "present"
    assert recs[s_bob.id].status == "not_detected"

    # Verify Audit log
    audit_res = await db_session.execute(
        select(AuditLog).where(AuditLog.session_id == session.id)
    )
    logs = audit_res.scalars().all()
    assert len(logs) == 1
    assert logs[0].action == "processed"
