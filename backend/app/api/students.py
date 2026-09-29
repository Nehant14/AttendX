"""
Student + enrollment endpoints.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_professor
from app.core.config import settings
from app.db.models import Professor, Student, StudentEmbedding
from app.db.session import get_db
from app.schemas.schemas import EmbeddingOut, EnrollmentResponse, StudentCreate, StudentOut
from app.services.enrollment_service import EnrollmentError, enroll_student_photos

router = APIRouter(prefix="/students", tags=["students"])


@router.post("", response_model=StudentOut, status_code=201)
async def create_student(
    payload: StudentCreate,
    db: AsyncSession = Depends(get_db),
    _professor: Professor = Depends(get_current_professor),
):
    existing = await db.execute(select(Student).where(Student.roll_no == payload.roll_no))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Student with this roll_no already exists")

    student = Student(roll_no=payload.roll_no, name=payload.name)
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


@router.post("/{roll_no}/enroll", response_model=EnrollmentResponse)
async def enroll_student(
    roll_no: str,
    files: list[UploadFile] = File(..., description="4-6 enrollment photos"),
    db: AsyncSession = Depends(get_db),
    _professor: Professor = Depends(get_current_professor),
):
    if not files:
        raise HTTPException(status_code=400, detail="At least one photo is required")

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    file_payloads: list[tuple[str, bytes]] = []
    for f in files:
        content = await f.read()
        if len(content) > max_bytes:
            raise HTTPException(status_code=413, detail=f"{f.filename} exceeds {settings.MAX_UPLOAD_MB}MB limit")
        file_payloads.append((f.filename or "upload.jpg", content))

    try:
        result = await enroll_student_photos(db, roll_no=roll_no, name=None, files=file_payloads)
    except EnrollmentError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return result


@router.get("/{roll_no}/embeddings", response_model=list[EmbeddingOut])
async def get_embeddings(
    roll_no: str,
    db: AsyncSession = Depends(get_db),
    _professor: Professor = Depends(get_current_professor),
):
    student_result = await db.execute(select(Student).where(Student.roll_no == roll_no))
    student = student_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    result = await db.execute(select(StudentEmbedding).where(StudentEmbedding.student_id == student.id))
    return list(result.scalars().all())
