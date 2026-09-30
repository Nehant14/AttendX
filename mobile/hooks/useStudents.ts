import { useState, useEffect, useCallback, useRef } from 'react';
import { studentsApi, LocalFile } from '@/services/api/students';
import { cacheStorage } from '@/services/storage/cache';
import { StudentOut, EnrollmentResponse, EmbeddingOut } from '@/types/api';

/**
 * Students live on the server (GET /students). The local cache is only used to
 * paint the screen instantly and as an offline fallback.
 */
export function useStudents() {
  const [students, setStudents] = useState<StudentOut[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);

  const loadStudents = useCallback(async () => {
    if (!hasData.current) setIsLoading(true);
    setError(null);

    try {
      const cached = await cacheStorage.getCachedStudents();
      if (cached.length > 0) {
        hasData.current = true;
        setStudents(cached);
        setIsLoading(false);
      }
    } catch {
      // cache problems must never block a network refresh
    }

    try {
      const fresh = await studentsApi.listStudents();
      hasData.current = true;
      setStudents(fresh);
      await cacheStorage.setCachedStudents(fresh);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const createStudent = async (rollNo: string, name: string): Promise<StudentOut> => {
    const student = await studentsApi.createStudent({ roll_no: rollNo, name });
    await cacheStorage.saveCachedStudent(student);
    setStudents((prev) => [student, ...prev.filter((s) => s.id !== student.id)]);
    return student;
  };

  const enrollPhotos = async (rollNo: string, photos: LocalFile[]): Promise<EnrollmentResponse> => {
    return await studentsApi.enrollStudent(rollNo, photos);
  };

  const getEmbeddings = useCallback(async (rollNo: string): Promise<EmbeddingOut[]> => {
    return await studentsApi.getEmbeddings(rollNo);
  }, []);

  return {
    students,
    isLoading,
    error,
    refreshStudents: loadStudents,
    createStudent,
    enrollPhotos,
    getEmbeddings,
  };
}
