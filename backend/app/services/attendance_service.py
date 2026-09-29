"""
Core attendance pipeline for a class session photo:

  detect -> quality gate -> embed -> match -> classify -> duplicate guard
  -> roster cross-check -> write draft attendance_records

This is invoked either synchronously (dev / USE_CELERY=False) right
after upload, or from a Celery task (app/workers/tasks.py) in
production. Either way it operates on a session_id and does not care
who called it.
"""
from __future__ import annotations

import os
import uuid

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import (
    AttendanceRecord,
    ClassRoster,
    ClassSession,
    DetectedFace,
    Student,
    StudentEmbedding,
)
from app.ml.detector import get_detector
from app.ml.matcher import PRESENT, UNMATCHED, match_all_faces
from app.ml.quality import crop_face, passes_quality
from app.services.audit_service import log_action


class ProcessingError(Exception):
    pass


async def _load_roster_embeddings(
    db: AsyncSession, class_id: int
) -> tuple[dict[int, Student], dict[int, list[np.ndarray]]]:
    result = await db.execute(
        select(Student)
        .join(ClassRoster, ClassRoster.student_id == Student.id)
        .where(ClassRoster.class_id == class_id)
    )
    students = {s.id: s for s in result.scalars().all()}

    if not students:
        return students, {}

    emb_result = await db.execute(
        select(StudentEmbedding).where(StudentEmbedding.student_id.in_(students.keys()))
    )
    embeddings_by_student: dict[int, list[np.ndarray]] = {sid: [] for sid in students}
    for row in emb_result.scalars().all():
        embeddings_by_student[row.student_id].append(np.asarray(row.embedding, dtype=np.float32))

    return students, embeddings_by_student


def _save_crop(image: np.ndarray, session_id: int, index: int) -> str:
    os.makedirs(settings.CROP_DIR, exist_ok=True)
    filename = f"session{session_id}_face{index}_{uuid.uuid4().hex[:6]}.jpg"
    path = os.path.join(settings.CROP_DIR, filename)
    cv2.imwrite(path, image)
    return path


async def process_session(db: AsyncSession, session_id: int) -> None:
    """Runs the full pipeline for a session and writes draft
    attendance_records + detected_faces rows. Sets session.status to
    'reviewed' on success or 'failed' on error."""
    session = await db.get(ClassSession, session_id)
    if session is None:
        raise ProcessingError(f"Session {session_id} not found")

    session.status = "processing"
    await db.commit()

    try:
        image = cv2.imread(session.photo_path)
        if image is None:
            raise ProcessingError(f"Could not read photo at {session.photo_path}")

        students, embeddings_by_student = await _load_roster_embeddings(db, session.class_id)
        if not students:
            raise ProcessingError("Class roster is empty or has no enrolled students")

        detector = get_detector()
        raw_faces = detector.detect(image)

        # Quality gate per detected face
        kept_faces = []
        detected_face_rows: list[DetectedFace] = []
        for i, face in enumerate(raw_faces):
            crop = crop_face(image, face.bbox)
            ok, reason = passes_quality(crop)
            crop_path = _save_crop(crop, session_id, i) if crop.size > 0 else None

            row = DetectedFace(
                session_id=session_id,
                bbox_x=face.bbox[0],
                bbox_y=face.bbox[1],
                bbox_width=face.bbox[2],
                bbox_height=face.bbox[3],
                det_score=face.det_score,
                quality_passed=ok,
                quality_reject_reason=reason,
                crop_path=crop_path,
            )
            detected_face_rows.append(row)
            if ok:
                kept_faces.append((i, face))

        # Match only the faces that passed quality
        query_embeddings = [f.embedding for _, f in kept_faces]
        match_results = match_all_faces(query_embeddings, embeddings_by_student)

        for (orig_idx, _face), match in zip(kept_faces, match_results):
            row = detected_face_rows[orig_idx]
            row.matched_student_id = match.student_id if match.classification != UNMATCHED else None
            row.match_score = match.score
            row.classification = match.classification

        db.add_all(detected_face_rows)
        await db.flush()

        # Roster cross-check: build draft attendance_records.
        # Best classification per student wins if somehow matched by >1 face
        # (shouldn't happen after the duplicate guard, but be defensive).
        best_by_student: dict[int, DetectedFace] = {}
        for row in detected_face_rows:
            if row.matched_student_id is None:
                continue
            existing = best_by_student.get(row.matched_student_id)
            if existing is None or (row.match_score or 0) > (existing.match_score or 0):
                best_by_student[row.matched_student_id] = row

        for student_id in students:
            match_row = best_by_student.get(student_id)
            if match_row is not None and match_row.classification == PRESENT:
                status_ = "present"
            elif match_row is not None and match_row.classification == "flagged":
                status_ = "flagged"
            else:
                status_ = "not_detected"

            record = AttendanceRecord(
                session_id=session_id,
                student_id=student_id,
                status=status_,
                confidence_score=match_row.match_score if match_row else None,
                matched_face_crop_path=match_row.crop_path if match_row else None,
            )
            db.add(record)

        session.status = "reviewed"
        session.error_detail = None
        await log_action(db, session_id=session_id, action="processed", actor="system", detail={
            "faces_detected": len(raw_faces),
            "faces_passed_quality": len(kept_faces),
        })
        await db.commit()

    except Exception as e:  # noqa: BLE001 - want to persist any failure reason
        await db.rollback()
        session = await db.get(ClassSession, session_id)
        if session is not None:
            session.status = "failed"
            session.error_detail = str(e)
            await db.commit()
        raise
