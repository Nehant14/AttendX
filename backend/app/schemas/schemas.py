"""
Pydantic request/response models for the API layer.
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class ProfessorCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    professor_id: int
    name: str


# ---------- Classes ----------
class ClassCreate(BaseModel):
    name: str


class ClassOut(BaseModel):
    id: int
    name: str
    professor_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RosterAddRequest(BaseModel):
    student_ids: list[int]


class RosterStudentOut(BaseModel):
    id: int
    roll_no: str
    name: str

    class Config:
        from_attributes = True


# ---------- Students / enrollment ----------
class StudentCreate(BaseModel):
    roll_no: str
    name: str


class StudentOut(BaseModel):
    id: int
    roll_no: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class EnrollmentPhotoResult(BaseModel):
    filename: str
    accepted: bool
    reject_reason: str | None = None
    quality_score: float | None = None


class EnrollmentResponse(BaseModel):
    student_id: int
    roll_no: str
    photos_submitted: int
    photos_accepted: int
    results: list[EnrollmentPhotoResult]


class EmbeddingOut(BaseModel):
    id: int
    quality_score: float | None
    model_version: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Sessions ----------
class SessionCreateResponse(BaseModel):
    session_id: int
    status: str


class SessionStatusResponse(BaseModel):
    session_id: int
    status: str
    error_detail: str | None = None


class BBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class DetectedFaceOut(BaseModel):
    id: int
    bbox: BBox
    det_score: float | None
    quality_passed: bool
    quality_reject_reason: str | None
    crop_path: str | None
    matched_student_id: int | None
    matched_student_name: str | None = None
    match_score: float | None
    classification: str | None


class NotDetectedStudentOut(BaseModel):
    student_id: int
    roll_no: str
    name: str


class SessionReviewResponse(BaseModel):
    session_id: int
    class_id: int
    session_date: date
    status: str
    photo_url: str
    faces: list[DetectedFaceOut]
    not_detected: list[NotDetectedStudentOut]
    summary: dict[str, int]


class ResolveRequest(BaseModel):
    detected_face_id: int
    action: str  # "confirm" | "reject"
    # If rejecting, optionally reassign to a different student instead of
    # leaving it unmatched (professor manually picks the right one).
    reassign_student_id: int | None = None


class ResolveResponse(BaseModel):
    detected_face_id: int
    classification: str
    matched_student_id: int | None


class FinalizeResponse(BaseModel):
    session_id: int
    status: str
    present_count: int
    absent_count: int
    flagged_unresolved_count: int


# ---------- Attendance / roster views ----------
class AttendanceRecordOut(BaseModel):
    student_id: int
    roll_no: str
    name: str
    status: str
    confidence_score: float | None

    class Config:
        from_attributes = True


class SessionSummaryOut(BaseModel):
    id: int
    session_date: date
    status: str
    present_count: int
    absent_count: int


# ---------- Audit ----------
class AuditLogOut(BaseModel):
    id: int
    action: str
    actor: str
    detail: dict | None
    created_at: datetime

    class Config:
        from_attributes = True
