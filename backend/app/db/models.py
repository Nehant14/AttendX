"""
ORM models. Mirrors the schema in the implementation plan:
professors, classes, students, class_roster, student_embeddings,
class_sessions, attendance_records, audit_log.
"""
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

EMBEDDING_DIM = 512


class Base(DeclarativeBase):
    pass


class Professor(Base):
    __tablename__ = "professors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    classes: Mapped[list["ClassModel"]] = relationship(back_populates="professor")


class ClassModel(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    professor_id: Mapped[int] = mapped_column(ForeignKey("professors.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    professor: Mapped["Professor"] = relationship(back_populates="classes")
    sessions: Mapped[list["ClassSession"]] = relationship(back_populates="class_")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    roll_no: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    embeddings: Mapped[list["StudentEmbedding"]] = relationship(back_populates="student")


class ClassRoster(Base):
    __tablename__ = "class_roster"

    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), primary_key=True)


class StudentEmbedding(Base):
    __tablename__ = "student_embeddings"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=False)
    source_image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="embeddings")


class ClassSession(Base):
    __tablename__ = "class_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False)
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    photo_path: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending|processing|reviewed|finalized|failed
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    class_: Mapped["ClassModel"] = relationship(back_populates="sessions")
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="session")
    detected_faces: Mapped[list["DetectedFace"]] = relationship(back_populates="session")


class DetectedFace(Base):
    """One row per face detected in a session photo (before/independent of matching)."""

    __tablename__ = "detected_faces"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("class_sessions.id"), nullable=False, index=True)
    bbox_x: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_y: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_width: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_height: Mapped[float] = mapped_column(Float, nullable=False)
    det_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_passed: Mapped[bool] = mapped_column(Boolean, default=True)
    quality_reject_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    crop_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    matched_student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"), nullable=True)
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    classification: Mapped[str | None] = mapped_column(String(32), nullable=True)  # present|flagged|unmatched
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["ClassSession"] = relationship(back_populates="detected_faces")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_session_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("class_sessions.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # present|absent|flagged|not_detected
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    matched_face_crop_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_professor: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["ClassSession"] = relationship(back_populates="attendance_records")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("class_sessions.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
