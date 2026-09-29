"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 512


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "professors",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "classes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("professor_id", sa.Integer, sa.ForeignKey("professors.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "students",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("roll_no", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "class_roster",
        sa.Column("class_id", sa.Integer, sa.ForeignKey("classes.id"), primary_key=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("students.id"), primary_key=True),
    )

    op.create_table(
        "student_embeddings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("students.id"), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=False),
        sa.Column("source_image_path", sa.Text, nullable=True),
        sa.Column("quality_score", sa.Float, nullable=True),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_student_embeddings_student_id", "student_embeddings", ["student_id"])
    op.execute(
        "CREATE INDEX ix_student_embeddings_vector ON student_embeddings "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    op.create_table(
        "class_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("class_id", sa.Integer, sa.ForeignKey("classes.id"), nullable=False),
        sa.Column("session_date", sa.Date, nullable=False),
        sa.Column("photo_path", sa.Text, nullable=False),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("error_detail", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "detected_faces",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.Integer, sa.ForeignKey("class_sessions.id"), nullable=False),
        sa.Column("bbox_x", sa.Float, nullable=False),
        sa.Column("bbox_y", sa.Float, nullable=False),
        sa.Column("bbox_width", sa.Float, nullable=False),
        sa.Column("bbox_height", sa.Float, nullable=False),
        sa.Column("det_score", sa.Float, nullable=True),
        sa.Column("quality_passed", sa.Boolean, server_default=sa.true()),
        sa.Column("quality_reject_reason", sa.String(64), nullable=True),
        sa.Column("crop_path", sa.Text, nullable=True),
        sa.Column("matched_student_id", sa.Integer, sa.ForeignKey("students.id"), nullable=True),
        sa.Column("match_score", sa.Float, nullable=True),
        sa.Column("classification", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_detected_faces_session_id", "detected_faces", ["session_id"])

    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.Integer, sa.ForeignKey("class_sessions.id"), nullable=False),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("students.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("confidence_score", sa.Float, nullable=True),
        sa.Column("matched_face_crop_path", sa.Text, nullable=True),
        sa.Column("reviewed_by_professor", sa.Boolean, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("session_id", "student_id", name="uq_session_student"),
    )
    op.create_index("ix_attendance_records_session_id", "attendance_records", ["session_id"])
    op.create_index("ix_attendance_records_student_id", "attendance_records", ["student_id"])

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.Integer, sa.ForeignKey("class_sessions.id"), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("actor", sa.String(255), nullable=False),
        sa.Column("detail", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("attendance_records")
    op.drop_table("detected_faces")
    op.drop_table("class_sessions")
    op.drop_index("ix_student_embeddings_vector", table_name="student_embeddings")
    op.drop_table("student_embeddings")
    op.drop_table("class_roster")
    op.drop_table("students")
    op.drop_table("classes")
    op.drop_table("professors")
