import { useState, useCallback, useRef } from 'react';
import { sessionsApi } from '@/services/api/sessions';
import { cacheStorage } from '@/services/storage/cache';
import { SessionSummaryOut } from '@/types/api';

/** Recent attendance sessions from GET /sessions, with a cached fallback. */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummaryOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);

  const refreshSessions = useCallback(async () => {
    setError(null);
    try {
      const cached = await cacheStorage.getCachedSessions();
      if (cached.length > 0 && !hasData.current) {
        hasData.current = true;
        setSessions(cached);
      }
    } catch {
      // ignore cache errors
    }

    try {
      const fresh = await sessionsApi.listSessions();
      hasData.current = true;
      setSessions(fresh);
      await cacheStorage.setCachedSessions(fresh);
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
    }
  }, []);

  return { sessions, error, refreshSessions };
}
