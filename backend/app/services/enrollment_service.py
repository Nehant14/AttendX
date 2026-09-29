"""
Enrollment pipeline: takes 4-6 photos of a student, runs each through
detect -> quality gate -> embed, and stores the accepted embeddings.
Photos that fail the quality gate (too small/blurry, no face, multiple
faces) are rejected with a reason so the mobile app can show
accept/reject feedback per photo, per the plan.
"""
from __future__ import annotations

import os
import uuid

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Student, StudentEmbedding
from app.ml.detector import get_detector
from app.ml.quality import crop_face, passes_quality


class EnrollmentError(Exception):
    pass


def _decode_image(raw_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise EnrollmentError("Could not decode image")
    return image


def _save_photo(raw_bytes: bytes, roll_no: str, suffix: str) -> str:
    os.makedirs(settings.ENROLLMENT_PHOTO_DIR, exist_ok=True)
    filename = f"{roll_no}_{uuid.uuid4().hex[:8]}_{suffix}.jpg"
    path = os.path.join(settings.ENROLLMENT_PHOTO_DIR, filename)
    with open(path, "wb") as f:
        f.write(raw_bytes)
    return path


async def get_or_create_student(db: AsyncSession, roll_no: str, name: str | None) -> Student:
    result = await db.execute(select(Student).where(Student.roll_no == roll_no))
    student = result.scalar_one_or_none()
    if student is None:
        if not name:
            raise EnrollmentError(f"No student with roll_no={roll_no}; provide `name` to create one")
        student = Student(roll_no=roll_no, name=name)
        db.add(student)
        await db.flush()
    return student


async def enroll_photo(
    db: AsyncSession,
    student: Student,
    filename: str,
    raw_bytes: bytes,
) -> dict:
    """Process a single enrollment photo. Returns a result dict describing
    whether it was accepted, and stores the embedding if so."""
    try:
        image = _decode_image(raw_bytes)
    except EnrollmentError as e:
        return {"filename": filename, "accepted": False, "reject_reason": str(e), "quality_score": None}

    detector = get_detector()
    faces = detector.detect(image)

    if len(faces) == 0:
        return {"filename": filename, "accepted": False, "reject_reason": "no_face_detected", "quality_score": None}
    if len(faces) > 1:
        return {
            "filename": filename,
            "accepted": False,
            "reject_reason": "multiple_faces_detected",
            "quality_score": None,
        }

    face = faces[0]
    crop = crop_face(image, face.bbox)
    ok, reason = passes_quality(crop)
    if not ok:
        return {"filename": filename, "accepted": False, "reject_reason": reason, "quality_score": None}

    quality_score = float(face.det_score)
    saved_path = _save_photo(raw_bytes, student.roll_no, uuid.uuid4().hex[:6])

    embedding_row = StudentEmbedding(
        student_id=student.id,
        embedding=face.embedding.tolist(),
        source_image_path=saved_path,
        quality_score=quality_score,
        model_version=settings.MODEL_VERSION,
    )
    db.add(embedding_row)

    return {
        "filename": filename,
        "accepted": True,
        "reject_reason": None,
        "quality_score": quality_score,
    }


async def enroll_student_photos(
    db: AsyncSession,
    roll_no: str,
    name: str | None,
    files: list[tuple[str, bytes]],
) -> dict:
    student = await get_or_create_student(db, roll_no, name)

    results = []
    for filename, raw_bytes in files:
        result = await enroll_photo(db, student, filename, raw_bytes)
        results.append(result)

    await db.commit()

    accepted = sum(1 for r in results if r["accepted"])
    return {
        "student_id": student.id,
        "roll_no": student.roll_no,
        "photos_submitted": len(files),
        "photos_accepted": accepted,
        "results": results,
    }
