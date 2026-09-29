"""
Auth endpoints: professor signup (not in the original plan's API surface
but needed to bootstrap the first user) and login.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import Professor
from app.db.session import get_db
from app.schemas.schemas import LoginRequest, ProfessorCreate, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: ProfessorCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Professor).where(Professor.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    professor = Professor(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(professor)
    await db.commit()
    await db.refresh(professor)

    token = create_access_token(subject=str(professor.id))
    return TokenResponse(access_token=token, professor_id=professor.id, name=professor.name)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Professor).where(Professor.email == payload.email))
    professor = result.scalar_one_or_none()

    if professor is None or not verify_password(payload.password, professor.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(subject=str(professor.id))
    return TokenResponse(access_token=token, professor_id=professor.id, name=professor.name)
