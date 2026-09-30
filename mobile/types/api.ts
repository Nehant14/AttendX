/**
 * API Data Models matching backend/app/schemas/schemas.py
 */

export interface ProfessorCreate {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  professor_id: number;
  name: string;
}

export interface ClassCreate {
  name: string;
}

export interface ClassOut {
  id: number;
  name: string;
  professor_id: number;
  created_at: string;
}

export interface RosterAddRequest {
  student_ids: number[];
}

export interface RosterStudentOut {
  id: number;
  roll_no: string;
  name: string;
}

export interface StudentCreate {
  roll_no: string;
  name: string;
}

export interface StudentOut {
  id: number;
  roll_no: string;
  name: string;
  created_at: string;
}

export interface EnrollmentPhotoResult {
  filename: string;
  accepted: boolean;
  reject_reason: string | null;
  quality_score: number | null;
}

export interface EnrollmentResponse {
  student_id: number;
  roll_no: string;
  photos_submitted: number;
  photos_accepted: number;
  results: EnrollmentPhotoResult[];
}

export interface EmbeddingOut {
  id: number;
  quality_score: number | null;
  model_version: string;
  created_at: string;
}

export interface SessionCreateResponse {
  session_id: number;
  status: 'pending' | 'processing' | 'reviewed' | 'finalized' | 'failed' | string;
}

export interface SessionStatusResponse {
  session_id: number;
  status: 'pending' | 'processing' | 'reviewed' | 'finalized' | 'failed' | string;
  error_detail: string | null;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFaceOut {
  id: number;
  bbox: BBox;
  det_score: number | null;
  quality_passed: boolean;
  quality_reject_reason: string | null;
  crop_path: string | null;
  matched_student_id: number | null;
  matched_student_name: string | null;
  match_score: number | null;
  classification: 'present' | 'flagged' | 'unmatched' | string | null;
}

export interface NotDetectedStudentOut {
  student_id: number;
  roll_no: string;
  name: string;
}

export interface SessionReviewResponse {
  session_id: number;
  class_id: number;
  session_date: string;
  status: string;
  photo_url: string;
  faces: DetectedFaceOut[];
  not_detected: NotDetectedStudentOut[];
  summary: {
    present?: number;
    flagged?: number;
    not_detected?: number;
    absent?: number;
    [key: string]: number | undefined;
  };
}

export interface ResolveRequest {
  detected_face_id: number;
  action: 'confirm' | 'reject';
  reassign_student_id?: number | null;
}

export interface ResolveResponse {
  detected_face_id: number;
  classification: string;
  matched_student_id: number | null;
}

export interface FinalizeResponse {
  session_id: number;
  status: string;
  present_count: number;
  absent_count: number;
  flagged_unresolved_count: number;
}

export interface AttendanceRecordOut {
  student_id: number;
  roll_no: string;
  name: string;
  status: string;
  confidence_score: number | null;
}

export interface SessionSummaryOut {
  id: number;
  class_id?: number;
  class_name?: string | null;
  session_date: string;
  status: string;
  present_count: number;
  absent_count: number;
}

export interface AuditLogOut {
  id: number;
  action: string;
  actor: string;
  detail: Record<string, any> | null;
  created_at: string;
}

export interface HealthResponse {
  status: string;
}
