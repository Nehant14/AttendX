import { useState, useEffect, useCallback } from 'react';
import { studentsApi, LocalFile } from '@/services/api/students';
import { classesApi } from '@/services/api/classes';
import { sessionsApi } from '@/services/api/sessions';
import { cacheStorage } from '@/services/storage/cache';
import {
  EmbeddingOut,
  EnrollmentResponse,
  ClassOut,
} from '@/types/api';

export interface StudentAttendanceEntry {
  sessionId: number;
  classId: number;
  className: string;
  sessionDate: string;
  status: 'present' | 'flagged' | 'absent' | 'not_detected';
  matchScore: number | null;
  cropUrl?: string | null;
}

export interface StudentCourseSummary {
  classId: number;
  className: string;
  totalSessions: number;
  presentCount: number;
  attendanceRate: number; // 0-100%
}

export function useStudentPortal(rollNo?: string | null) {
  const [loading, setLoading] = useState<boolean>(true);
  const [embeddings, setEmbeddings] = useState<EmbeddingOut[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<ClassOut[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<StudentAttendanceEntry[]>([]);
  const [courseSummaries, setCourseSummaries] = useState<StudentCourseSummary[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    presentSessions: 0,
    flaggedSessions: 0,
    absentSessions: 0,
    attendanceRate: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const loadStudentData = useCallback(async () => {
    if (!rollNo) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch embeddings
      let embData: EmbeddingOut[] = [];
      try {
        embData = await studentsApi.getEmbeddings(rollNo);
        setEmbeddings(embData);
      } catch (embErr) {
        console.warn('Could not load student embeddings:', embErr);
      }

      // 2. Discover enrolled classes
      const cachedClasses = await cacheStorage.getCachedClasses();
      const matchingClasses: ClassOut[] = [];

      for (const cls of cachedClasses) {
        try {
          const roster = await classesApi.getRoster(cls.id);
          const found = roster.some((s) => s.roll_no.toUpperCase() === rollNo.toUpperCase());
          if (found) {
            matchingClasses.push(cls);
          }
        } catch {
          // ignore individual class errors
        }
      }
      setEnrolledClasses(matchingClasses);

      // 3. Scan sessions for attendance history
      const cachedSessions = await cacheStorage.getCachedSessions();
      const history: StudentAttendanceEntry[] = [];
      const classMap = new Map<number, string>(cachedClasses.map((c: ClassOut) => [c.id, c.name]));

      for (const sess of cachedSessions) {
        try {
          const review = await sessionsApi.reviewSession(sess.id);
          const clsName: string = classMap.get(review.class_id) || `Course #${review.class_id}`;

          // Check if face was detected for this student
          const matchedFace = review.faces.find(
            (f) => f.matched_student_name?.toLowerCase().includes(rollNo.toLowerCase()) || false
          );

          // Check if not_detected list has this student
          const notDet = review.not_detected.find(
            (nd) => nd.roll_no.toUpperCase() === rollNo.toUpperCase()
          );

          if (matchedFace) {
            history.push({
              sessionId: review.session_id,
              classId: review.class_id,
              className: clsName,
              sessionDate: review.session_date,
              status: matchedFace.classification === 'present' ? 'present' : 'flagged',
              matchScore: matchedFace.match_score,
            });
          } else if (notDet) {
            history.push({
              sessionId: review.session_id,
              classId: review.class_id,
              className: clsName,
              sessionDate: review.session_date,
              status: review.status === 'finalized' ? 'absent' : 'not_detected',
              matchScore: null,
            });
          }
        } catch {
          // ignore session if review not yet available
        }
      }

      setAttendanceHistory(history);

      // 4. Compute statistics
      const total = history.length;
      const present = history.filter((h) => h.status === 'present').length;
      const flagged = history.filter((h) => h.status === 'flagged').length;
      const absent = history.filter((h) => h.status === 'absent' || h.status === 'not_detected').length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;

      setStats({
        totalSessions: total,
        presentSessions: present,
        flaggedSessions: flagged,
        absentSessions: absent,
        attendanceRate: rate,
      });

      // Course-by-course breakdown
      const summaryByCourse: StudentCourseSummary[] = matchingClasses.map((cls) => {
        const courseHist = history.filter((h) => h.classId === cls.id);
        const cTotal = courseHist.length;
        const cPresent = courseHist.filter((h) => h.status === 'present').length;
        const cRate = cTotal > 0 ? Math.round((cPresent / cTotal) * 100) : 0;
        return {
          classId: cls.id,
          className: cls.name,
          totalSessions: cTotal,
          presentCount: cPresent,
          attendanceRate: cRate,
        };
      });
      setCourseSummaries(summaryByCourse);
    } catch (err: any) {
      setError(err.message || 'Failed to load student portal data');
    } finally {
      setLoading(false);
    }
  }, [rollNo]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  const enrollSelfPhotos = async (photos: LocalFile[]): Promise<EnrollmentResponse> => {
    if (!rollNo) throw new Error('No student roll number specified');
    const res = await studentsApi.enrollStudent(rollNo, photos);
    await loadStudentData();
    return res;
  };

  return {
    loading,
    error,
    embeddings,
    enrolledClasses,
    attendanceHistory,
    courseSummaries,
    stats,
    refresh: loadStudentData,
    enrollSelfPhotos,
  };
}
