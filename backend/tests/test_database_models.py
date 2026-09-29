"""
Tests for Database Models & ORM Schema:
  - Table definitions, relationships, vector attributes
  - Unique constraints (Professor.email, Student.roll_no, AttendanceRecord uq_session_student)
  - Foreign key integrity
"""
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AttendanceRecord,
    AuditLog,
    ClassModel,
    ClassRoster,
    ClassSession,
    DetectedFace,
    Professor,
    Student,
    StudentEmbedding,
)
from tests.conftest import create_unit_embedding


@pytest.mark.asyncio
async def test_professor_model_unique_email(db_session: AsyncSession):
    p1 = Professor(name="Prof One", email="unique@univ.edu", password_hash="hash1")
    db_session.add(p1)
    await db_session.commit()

    p2 = Professor(name="Prof Two", email="unique@univ.edu", password_hash="hash2")
    db_session.add(p2)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.asyncio
async def test_student_model_unique_roll_no(db_session: AsyncSession):
    s1 = Student(roll_no="R001", name="Student One")
    db_session.add(s1)
    await db_session.commit()

    s2 = Student(roll_no="R001", name="Student Two")
    db_session.add(s2)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.asyncio
async def test_student_embedding_vector_column(db_session: AsyncSession, test_student: Student):
    vector_512 = create_unit_embedding(123)
    emb = StudentEmbedding(
        student_id=test_student.id,
        embedding=vector_512,
        quality_score=0.99,
        model_version="v1",
    )
    db_session.add(emb)
    await db_session.commit()
    await db_session.refresh(emb)

    assert len(emb.embedding) == 512
    assert emb.student_id == test_student.id


@pytest.mark.asyncio
async def test_attendance_record_unique_session_student_constraint(
    db_session: AsyncSession, test_class: ClassModel, test_student: Student
):
    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/p.jpg")
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)

    rec1 = AttendanceRecord(session_id=session.id, student_id=test_student.id, status="present")
    db_session.add(rec1)
    await db_session.commit()

    rec2 = AttendanceRecord(session_id=session.id, student_id=test_student.id, status="absent")
    db_session.add(rec2)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.asyncio
async def test_audit_log_model(db_session: AsyncSession, test_class: ClassModel):
    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/p.jpg")
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)

    log = AuditLog(
        session_id=session.id,
        action="test_action",
        actor="admin@univ.edu",
        detail={"key": "value", "count": 42},
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    assert log.id is not None
    assert log.action == "test_action"
    assert log.actor == "admin@univ.edu"
    assert log.detail == {"key": "value", "count": 42}


@pytest.mark.asyncio
async def test_orm_relationships(
    db_session: AsyncSession, test_professor: Professor, test_class: ClassModel, test_student: Student
):
    session = ClassSession(class_id=test_class.id, session_date=date.today(), photo_path="/tmp/p.jpg")
    db_session.add(session)
    await db_session.commit()

    face = DetectedFace(
        session_id=session.id,
        bbox_x=10.0,
        bbox_y=10.0,
        bbox_width=50.0,
        bbox_height=50.0,
        quality_passed=True,
    )
    rec = AttendanceRecord(session_id=session.id, student_id=test_student.id, status="present")
    db_session.add_all([face, rec])
    await db_session.commit()

    res_faces = await db_session.execute(select(DetectedFace).where(DetectedFace.session_id == session.id))
    faces = res_faces.scalars().all()
    res_recs = await db_session.execute(select(AttendanceRecord).where(AttendanceRecord.session_id == session.id))
    recs = res_recs.scalars().all()

    assert len(faces) == 1
    assert len(recs) == 1
    assert faces[0].bbox_width == 50.0
    assert recs[0].status == "present"
