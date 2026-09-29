"""
Session endpoints: the core capture -> review -> resolve -> finalize
loop described in the plan.
"""
import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_professor
from app.core.config import settings
from app.db.models import (
    AttendanceRecord,
    ClassModel,
    ClassRoster,
    ClassSession,
    DetectedFace,
    Professor,
    Student,
)
from app.db.session import get_db
from app.ml.matcher import FLAGGED, PRESENT
from app.schemas.schemas import (
    AuditLogOut,
    BBox,
    DetectedFaceOut,
    FinalizeResponse,
    NotDetectedStudentOut,
    ResolveRequest,
    ResolveResponse,
    SessionCreateResponse,
    SessionReviewResponse,
    SessionStatusResponse,
)
from app.services.attendance_service import process_session
from app.services.audit_service import get_session_audit_log, log_action

router = APIRouter(prefix="/sessions", tags=["sessions"])


async def _get_owned_session(db: AsyncSession, session_id: int, professor: Professor) -> ClassSession:
    session = await db.get(ClassSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    class_ = await db.get(ClassModel, session.class_id)
    if class_ is None or class_.professor_id != professor.id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("", response_model=SessionCreateResponse, status_code=201)
async def create_session(
    class_id: int = Form(...),
    session_date: date | None = Form(None),
    photo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    class_ = await db.get(ClassModel, class_id)
    if class_ is None or class_.professor_id != professor.id:
        raise HTTPException(status_code=404, detail="Class not found")

    content = await photo.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Photo exceeds {settings.MAX_UPLOAD_MB}MB limit")

    os.makedirs(settings.SESSION_PHOTO_DIR, exist_ok=True)
    filename = f"class{class_id}_{uuid.uuid4().hex}.jpg"
    path = os.path.join(settings.SESSION_PHOTO_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)

    session = ClassSession(
        class_id=class_id,
        session_date=session_date or date.today(),
        photo_path=path,
        status="pending",
    )
    db.add(session)
    await db.flush()
    await log_action(db, session_id=session.id, action="session_created", actor=professor.email)
    await db.commit()
    await db.refresh(session)

    if settings.USE_CELERY:
        from app.workers.tasks import process_session_task

        process_session_task.delay(session.id)
    else:
        # Synchronous processing for local dev without Celery/Redis running.
        await process_session(db, session.id)

    return SessionCreateResponse(session_id=session.id, status=session.status)


@router.get("/{session_id}/status", response_model=SessionStatusResponse)
async def get_status(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    session = await _get_owned_session(db, session_id, professor)
    return SessionStatusResponse(session_id=session.id, status=session.status, error_detail=session.error_detail)


@router.get("/{session_id}/review", response_model=SessionReviewResponse)
async def review_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    session = await _get_owned_session(db, session_id, professor)
    if session.status not in ("reviewed", "finalized"):
        raise HTTPException(status_code=409, detail=f"Session is not ready for review (status={session.status})")

    faces_result = await db.execute(select(DetectedFace).where(DetectedFace.session_id == session_id))
    faces = list(faces_result.scalars().all())

    student_ids = {f.matched_student_id for f in faces if f.matched_student_id is not None}
    students_by_id: dict[int, Student] = {}
    if student_ids:
        s_result = await db.execute(select(Student).where(Student.id.in_(student_ids)))
        students_by_id = {s.id: s for s in s_result.scalars().all()}

    face_out = [
        DetectedFaceOut(
            id=f.id,
            bbox=BBox(x=f.bbox_x, y=f.bbox_y, width=f.bbox_width, height=f.bbox_height),
            det_score=f.det_score,
            quality_passed=f.quality_passed,
            quality_reject_reason=f.quality_reject_reason,
            crop_path=f.crop_path,
            matched_student_id=f.matched_student_id,
            matched_student_name=students_by_id[f.matched_student_id].name if f.matched_student_id in students_by_id else None,
            match_score=f.match_score,
            classification=f.classification,
        )
        for f in faces
    ]

    records_result = await db.execute(
        select(AttendanceRecord, Student)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(AttendanceRecord.session_id == session_id)
    )
    records = records_result.all()

    not_detected = [
        NotDetectedStudentOut(student_id=s.id, roll_no=s.roll_no, name=s.name)
        for rec, s in records
        if rec.status == "not_detected"
    ]

    summary = {"present": 0, "flagged": 0, "not_detected": 0, "absent": 0}
    for rec, _s in records:
        summary[rec.status] = summary.get(rec.status, 0) + 1

    return SessionReviewResponse(
        session_id=session.id,
        class_id=session.class_id,
        session_date=session.session_date,
        status=session.status,
        photo_url=f"/media/{os.path.basename(session.photo_path)}",
        faces=face_out,
        not_detected=not_detected,
        summary=summary,
    )


@router.post("/{session_id}/resolve", response_model=ResolveResponse)
async def resolve_face(
    session_id: int,
    payload: ResolveRequest,
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    session = await _get_owned_session(db, session_id, professor)
    if session.status == "finalized":
        raise HTTPException(status_code=409, detail="Session already finalized")

    face = await db.get(DetectedFace, payload.detected_face_id)
    if face is None or face.session_id != session_id:
        raise HTTPException(status_code=404, detail="Detected face not found in this session")

    old_student_id = face.matched_student_id

    if payload.action == "confirm":
        face.classification = PRESENT
    elif payload.action == "reject":
        if payload.reassign_student_id is not None:
            face.matched_student_id = payload.reassign_student_id
            face.classification = PRESENT
        else:
            face.matched_student_id = None
            face.classification = "unmatched"
    else:
        raise HTTPException(status_code=400, detail="action must be 'confirm' or 'reject'")

    # Sync the corresponding attendance_records rows.
    if old_student_id is not None and old_student_id != face.matched_student_id:
        old_record = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == session_id, AttendanceRecord.student_id == old_student_id
            )
        )
        old_row = old_record.scalar_one_or_none()
        if old_row is not None:
            old_row.status = "not_detected"
            old_row.confidence_score = None
            old_row.matched_face_crop_path = None

    if face.matched_student_id is not None:
        new_record = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == session_id, AttendanceRecord.student_id == face.matched_student_id
            )
        )
        new_row = new_record.scalar_one_or_none()
        if new_row is not None:
            new_row.status = "present"
            new_row.confidence_score = face.match_score
            new_row.matched_face_crop_path = face.crop_path
            new_row.reviewed_by_professor = True

    await log_action(
        db,
        session_id=session_id,
        action=f"face_{payload.action}ed",
        actor=professor.email,
        detail={"detected_face_id": face.id, "student_id": face.matched_student_id},
    )
    await db.commit()

    return ResolveResponse(
        detected_face_id=face.id,
        classification=face.classification,
        matched_student_id=face.matched_student_id,
    )


@router.post("/{session_id}/finalize", response_model=FinalizeResponse)
async def finalize_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    session = await _get_owned_session(db, session_id, professor)
    if session.status != "reviewed":
        raise HTTPException(status_code=409, detail=f"Session must be in 'reviewed' state (got {session.status})")

    records_result = await db.execute(select(AttendanceRecord).where(AttendanceRecord.session_id == session_id))
    records = list(records_result.scalars().all())

    flagged_unresolved = [r for r in records if r.status == FLAGGED]
    for r in flagged_unresolved:
        # Per the plan: any student still not_detected/flagged and
        # unconfirmed at finalize time is marked absent, to minimize the
        # risk of a false "present" slipping through unreviewed.
        r.status = "absent"

    for r in records:
        if r.status == "not_detected":
            r.status = "absent"

    session.status = "finalized"

    present_count = sum(1 for r in records if r.status == "present")
    absent_count = sum(1 for r in records if r.status == "absent")

    await log_action(
        db,
        session_id=session_id,
        action="finalized",
        actor=professor.email,
        detail={"present": present_count, "absent": absent_count},
    )
    await db.commit()

    return FinalizeResponse(
        session_id=session.id,
        status=session.status,
        present_count=present_count,
        absent_count=absent_count,
        flagged_unresolved_count=len(flagged_unresolved),
    )


@router.get("/{session_id}/audit", response_model=list[AuditLogOut])
async def get_audit(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    await _get_owned_session(db, session_id, professor)
    return await get_session_audit_log(db, session_id)
