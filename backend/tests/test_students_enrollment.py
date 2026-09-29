"""
Tests for Students & Photo Enrollment API endpoints and services:
  - Student creation & duplicate roll_no 400
  - Upload file size validation (413 > 15MB)
  - Single & multi-photo enrollment pipelines:
      * No face detected
      * Multiple faces detected
      * Quality gate rejection
      * Successful enrollment & embedding persistence
  - Fetch student embeddings (GET /students/{roll_no}/embeddings)
"""
import pytest
import numpy as np
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Student, StudentEmbedding
from app.ml.detector import Face
from app.services.enrollment_service import EnrollmentError, enroll_student_photos
from tests.conftest import create_synthetic_image_bytes, create_unit_embedding


@pytest.mark.asyncio
async def test_create_student_success(client: AsyncClient, auth_headers: dict[str, str]):
    payload = {"roll_no": "STU100", "name": "Bob Marley"}
    response = await client.post("/students", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["roll_no"] == "STU100"
    assert data["name"] == "Bob Marley"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_student_duplicate_roll_no(
    client: AsyncClient, auth_headers: dict[str, str], test_student: Student
):
    payload = {"roll_no": test_student.roll_no, "name": "Duplicate Student"}
    response = await client.post("/students", json=payload, headers=auth_headers)
    assert response.status_code == 400
    assert "Student with this roll_no already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_enroll_student_no_files(
    client: AsyncClient, auth_headers: dict[str, str], test_student: Student
):
    response = await client.post(f"/students/{test_student.roll_no}/enroll", headers=auth_headers)
    assert response.status_code == 422  # FastAPI field validation error for missing File parameter


@pytest.mark.asyncio
async def test_enroll_student_file_too_large(
    client: AsyncClient, auth_headers: dict[str, str], test_student: Student, monkeypatch: pytest.MonkeyPatch
):
    # Set max limit low to trigger 413
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    huge_payload = b"0" * (2 * 1024 * 1024)  # 2 MB

    files = [("files", ("huge.jpg", huge_payload, "image/jpeg"))]
    response = await client.post(
        f"/students/{test_student.roll_no}/enroll", files=files, headers=auth_headers
    )
    assert response.status_code == 413
    assert "exceeds 1MB limit" in response.json()["detail"]


@pytest.mark.asyncio
async def test_enroll_service_nonexistent_student_no_name(db_session: AsyncSession):
    with pytest.raises(EnrollmentError, match="No student with roll_no="):
        await enroll_student_photos(db_session, roll_no="STU999", name=None, files=[("photo.jpg", b"123")])


@pytest.mark.asyncio
async def test_enroll_service_no_face_detected(
    db_session: AsyncSession, test_student: Student, mock_detector, tmp_storage: str
):
    mock_detector(faces=[])  # Detector finds 0 faces
    img_bytes = create_synthetic_image_bytes(100, 100)

    result = await enroll_student_photos(
        db_session, roll_no=test_student.roll_no, name=None, files=[("photo1.jpg", img_bytes)]
    )
    assert result["photos_submitted"] == 1
    assert result["photos_accepted"] == 0
    assert result["results"][0]["reject_reason"] == "no_face_detected"


@pytest.mark.asyncio
async def test_enroll_service_multiple_faces_detected(
    db_session: AsyncSession, test_student: Student, mock_detector, tmp_storage: str
):
    emb1 = np.array(create_unit_embedding(1), dtype=np.float32)
    emb2 = np.array(create_unit_embedding(2), dtype=np.float32)

    face1 = Face(bbox=(10, 10, 50, 50), det_score=0.95, embedding=emb1)
    face2 = Face(bbox=(70, 70, 50, 50), det_score=0.92, embedding=emb2)
    mock_detector(faces=[face1, face2])

    img_bytes = create_synthetic_image_bytes(200, 200)

    result = await enroll_student_photos(
        db_session, roll_no=test_student.roll_no, name=None, files=[("group.jpg", img_bytes)]
    )
    assert result["photos_accepted"] == 0
    assert result["results"][0]["reject_reason"] == "multiple_faces_detected"


@pytest.mark.asyncio
async def test_enroll_service_quality_rejection(
    db_session: AsyncSession, test_student: Student, mock_detector, tmp_storage: str
):
    emb = np.array(create_unit_embedding(1), dtype=np.float32)
    # Face bbox is too small (10x10 < min_face_size 40)
    face = Face(bbox=(10, 10, 10, 10), det_score=0.95, embedding=emb)
    mock_detector(faces=[face])

    img_bytes = create_synthetic_image_bytes(200, 200)

    result = await enroll_student_photos(
        db_session, roll_no=test_student.roll_no, name=None, files=[("tiny_face.jpg", img_bytes)]
    )
    assert result["photos_accepted"] == 0
    assert result["results"][0]["reject_reason"] == "face_too_small"


@pytest.mark.asyncio
async def test_enroll_service_success(
    db_session: AsyncSession, test_student: Student, mock_detector, tmp_storage: str
):
    emb = np.array(create_unit_embedding(10), dtype=np.float32)
    face = Face(bbox=(20, 20, 100, 100), det_score=0.98, embedding=emb)
    mock_detector(faces=[face])

    img_bytes = create_synthetic_image_bytes(300, 300)

    result = await enroll_student_photos(
        db_session, roll_no=test_student.roll_no, name=None, files=[("valid.jpg", img_bytes)]
    )
    assert result["photos_submitted"] == 1
    assert result["photos_accepted"] == 1
    assert result["results"][0]["accepted"] is True
    assert result["results"][0]["quality_score"] == 0.98

    # Verify embedding saved to database
    emb_result = await db_session.execute(
        select(StudentEmbedding).where(StudentEmbedding.student_id == test_student.id)
    )
    db_embeddings = emb_result.scalars().all()
    assert len(db_embeddings) == 1
    assert len(db_embeddings[0].embedding) == 512
    assert db_embeddings[0].quality_score == 0.98


@pytest.mark.asyncio
async def test_get_embeddings_api(
    client: AsyncClient,
    auth_headers: dict[str, str],
    test_student: Student,
    db_session: AsyncSession,
):
    emb_row = StudentEmbedding(
        student_id=test_student.id,
        embedding=create_unit_embedding(1),
        quality_score=0.95,
        model_version=settings.MODEL_VERSION,
    )
    db_session.add(emb_row)
    await db_session.commit()

    response = await client.get(
        f"/students/{test_student.roll_no}/embeddings", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["quality_score"] == 0.95
    assert data[0]["model_version"] == settings.MODEL_VERSION


@pytest.mark.asyncio
async def test_get_embeddings_nonexistent_student(
    client: AsyncClient, auth_headers: dict[str, str]
):
    response = await client.get("/students/NONEXISTENT/embeddings", headers=auth_headers)
    assert response.status_code == 404
    assert "Student not found" in response.json()["detail"]
