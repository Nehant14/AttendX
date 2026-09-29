import { useState, useEffect, useCallback } from 'react';
import { classesApi } from '@/services/api/classes';
import { cacheStorage } from '@/services/storage/cache';
import { ClassOut, RosterStudentOut } from '@/types/api';

export function useClasses() {
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cached = await cacheStorage.getCachedClasses();
      setClasses(cached);
    } catch (err: any) {
      setError(err.message || 'Failed to load classes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const createClass = async (name: string): Promise<ClassOut> => {
    const newClass = await classesApi.createClass({ name });
    await cacheStorage.saveCachedClass(newClass);
    setClasses((prev) => [newClass, ...prev.filter((c) => c.id !== newClass.id)]);
    return newClass;
  };

  const getRoster = async (classId: number): Promise<RosterStudentOut[]> => {
    return await classesApi.getRoster(classId);
  };

  const addToRoster = async (classId: number, studentIds: number[]): Promise<void> => {
    await classesApi.addToRoster(classId, { student_ids: studentIds });
  };

  return {
    classes,
    isLoading,
    error,
    refreshClasses: loadClasses,
    createClass,
    getRoster,
    addToRoster,
  };
}
