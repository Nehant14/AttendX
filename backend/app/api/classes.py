"""
Class + roster management endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_professor
from app.db.models import ClassModel, ClassRoster, Professor, Student
from app.db.session import get_db
from app.schemas.schemas import ClassCreate, ClassOut, RosterAddRequest, RosterStudentOut

router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("", response_model=list[ClassOut])
async def list_classes(
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    """All classes owned by the current professor, newest first."""
    result = await db.execute(
        select(ClassModel)
        .where(ClassModel.professor_id == professor.id)
        .order_by(ClassModel.created_at.desc(), ClassModel.id.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=ClassOut, status_code=201)
async def create_class(
    payload: ClassCreate,
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    class_ = ClassModel(name=payload.name, professor_id=professor.id)
    db.add(class_)
    await db.commit()
    await db.refresh(class_)
    return class_


async def _get_owned_class(db: AsyncSession, class_id: int, professor: Professor) -> ClassModel:
    class_ = await db.get(ClassModel, class_id)
    if class_ is None or class_.professor_id != professor.id:
        raise HTTPException(status_code=404, detail="Class not found")
    return class_


@router.post("/{class_id}/roster", status_code=204)
async def add_to_roster(
    class_id: int,
    payload: RosterAddRequest,
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    await _get_owned_class(db, class_id, professor)

    existing = await db.execute(select(ClassRoster.student_id).where(ClassRoster.class_id == class_id))
    existing_ids = {row[0] for row in existing.all()}

    for student_id in payload.student_ids:
        if student_id in existing_ids:
            continue
        student = await db.get(Student, student_id)
        if student is None:
            raise HTTPException(status_code=404, detail=f"Student {student_id} not found")
        db.add(ClassRoster(class_id=class_id, student_id=student_id))

    await db.commit()


@router.get("/{class_id}/roster", response_model=list[RosterStudentOut])
async def get_roster(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    professor: Professor = Depends(get_current_professor),
):
    await _get_owned_class(db, class_id, professor)

    result = await db.execute(
        select(Student).join(ClassRoster, ClassRoster.student_id == Student.id).where(ClassRoster.class_id == class_id)
    )
    return list(result.scalars().all())
