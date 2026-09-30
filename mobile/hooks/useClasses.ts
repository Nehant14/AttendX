import { useState, useEffect, useCallback, useRef } from 'react';
import { classesApi } from '@/services/api/classes';
import { cacheStorage } from '@/services/storage/cache';
import { ClassOut, RosterStudentOut } from '@/types/api';

/**
 * Classes live on the server (GET /classes). The local cache is only used to
 * paint the screen instantly and as an offline fallback.
 */
export function useClasses() {
  const [classes, setClasses] = useState<ClassOut[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);

  const loadClasses = useCallback(async () => {
    if (!hasData.current) setIsLoading(true);
    setError(null);

    // 1. Show whatever we had last time straight away.
    try {
      const cached = await cacheStorage.getCachedClasses();
      if (cached.length > 0) {
        hasData.current = true;
        setClasses(cached);
        setIsLoading(false);
      }
    } catch {
      // cache problems must never block a network refresh
    }

    // 2. Refresh from the server (source of truth).
    try {
      const fresh = await classesApi.listClasses();
      hasData.current = true;
      setClasses(fresh);
      await cacheStorage.setCachedClasses(fresh);
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

  const getRoster = useCallback(async (classId: number): Promise<RosterStudentOut[]> => {
    return await classesApi.getRoster(classId);
  }, []);

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
