"""
Global pytest configuration and fixtures for AttendX test suite.
Provides:
  - Database schema initialization on dedicated PostgreSQL test database
  - Clean transaction isolation & table truncations per test
  - NullPool async engine to prevent asyncpg event loop conflicts
  - FastAPI AsyncClient fixture for API testing
  - Auth fixtures (registered professor, JWT headers)
  - Synthetic data generators & ML mocks
  - Storage isolation & cleanup
"""
import os
import shutil
import tempfile
from collections.abc import AsyncGenerator, Generator

import cv2
import numpy as np
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Force settings to use test database URL if set in environment
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.models import Base, ClassModel, Professor, Student
from app.db.session import get_db
from app.main import app
from app.ml.detector import Face


def get_test_engine():
    """Create a fresh async engine with NullPool to prevent event-loop conflicts in pytest-asyncio."""
    return create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_database():
    """Create pgvector extension and all tables once for the test session."""
    engine = get_test_engine()
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    yield
    engine = get_test_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session for testing. Truncates all tables after test execution

    to guarantee clean test isolation.
    """
    engine = get_test_engine()
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    async with session_factory() as session:
        yield session

    # Cleanup: truncate tables after test
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(text(f'TRUNCATE TABLE "{table.name}" CASCADE;'))
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an HTTP client bound to the FastAPI app with the DB dependency overridden."""
    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def tmp_storage(monkeypatch: pytest.MonkeyPatch) -> Generator[str, None, None]:
    """Isolate storage operations in a temporary directory for tests."""
    temp_dir = tempfile.mkdtemp()
    sessions_dir = os.path.join(temp_dir, "sessions")
    enrollment_dir = os.path.join(temp_dir, "enrollment")
    crops_dir = os.path.join(temp_dir, "crops")

    os.makedirs(sessions_dir, exist_ok=True)
    os.makedirs(enrollment_dir, exist_ok=True)
    os.makedirs(crops_dir, exist_ok=True)

    monkeypatch.setattr(settings, "STORAGE_ROOT", temp_dir)
    monkeypatch.setattr(settings, "SESSION_PHOTO_DIR", sessions_dir)
    monkeypatch.setattr(settings, "ENROLLMENT_PHOTO_DIR", enrollment_dir)
    monkeypatch.setattr(settings, "CROP_DIR", crops_dir)

    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest_asyncio.fixture
async def test_professor(db_session: AsyncSession) -> Professor:
    """Create a default test professor in the database."""
    prof = Professor(
        name="Dr. Test Professor",
        email="prof.test@university.edu",
        password_hash=hash_password("secret123"),
    )
    db_session.add(prof)
    await db_session.commit()
    await db_session.refresh(prof)
    return prof


@pytest.fixture
def auth_headers(test_professor: Professor) -> dict[str, str]:
    """Return bearer auth headers for the test professor."""
    token = create_access_token(subject=str(test_professor.id))
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def test_class(db_session: AsyncSession, test_professor: Professor) -> ClassModel:
    """Create a default test class for the test professor."""
    cls = ClassModel(name="CS101 Intro to AI", professor_id=test_professor.id)
    db_session.add(cls)
    await db_session.commit()
    await db_session.refresh(cls)
    return cls


@pytest_asyncio.fixture
async def test_student(db_session: AsyncSession) -> Student:
    """Create a default test student in the database."""
    student = Student(roll_no="STU001", name="Alice Smith")
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)
    return student


def create_synthetic_image_bytes(width: int = 200, height: int = 200, color: tuple[int, int, int] = (100, 150, 200)) -> bytes:
    """Helper to generate encoded JPEG bytes for testing file uploads."""
    img = np.full((height, width, 3), color, dtype=np.uint8)
    img[::4, ::4] = (255, 255, 255)
    success, encoded = cv2.imencode(".jpg", img)
    assert success, "Failed to encode test image"
    return encoded.tobytes()


@pytest.fixture
def sample_jpeg_bytes() -> bytes:
    return create_synthetic_image_bytes(300, 300)


def create_unit_embedding(seed: int = 42) -> list[float]:
    """Helper to create a deterministic 512-d unit vector for embedding tests."""
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(512).astype(np.float32)
    v = v / np.linalg.norm(v)
    return v.tolist()


class DummyDetector:
    """Mock detector returning preconfigured Face objects."""

    def __init__(self, faces: list[Face] | None = None) -> None:
        self.faces = faces or []

    def detect(self, image: np.ndarray) -> list[Face]:
        return self.faces


@pytest.fixture
def mock_detector(monkeypatch: pytest.MonkeyPatch):
    """Factory fixture to patch get_detector() with custom dummy detector."""
    def _patch(faces: list[Face]):
        dummy = DummyDetector(faces)
        monkeypatch.setattr("app.services.attendance_service.get_detector", lambda: dummy)
        monkeypatch.setattr("app.services.enrollment_service.get_detector", lambda: dummy)
        monkeypatch.setattr("app.ml.embedder.get_detector", lambda: dummy)
        return dummy

    return _patch
