import { useState, useEffect, useCallback, useRef } from 'react';
import { sessionsApi } from '@/services/api/sessions';
import { cacheStorage } from '@/services/storage/cache';
import { apiClient } from '@/services/api/client';
import {
  SessionReviewResponse,
  ResolveRequest,
  FinalizeResponse,
  AuditLogOut,
} from '@/types/api';
import { LocalFile } from '@/services/api/students';
import { Config } from '@/constants/config';

export function useAttendanceSession(sessionId?: number) {
  const [currentSessionId, setCurrentSessionId] = useState<number | undefined>(sessionId);
  const [status, setStatus] = useState<string>('idle');
  const [reviewData, setReviewData] = useState<SessionReviewResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [mediaBaseUrl, setMediaBaseUrl] = useState<string>('');

  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    apiClient.getBaseUrl().then(setMediaBaseUrl);
  }, []);

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, []);

  const loadReview = useCallback(async (id: number) => {
    try {
      const data = await sessionsApi.reviewSession(id);
      setReviewData(data);
      setStatus(data.status);
    } catch (err: any) {
      setError(err.message || 'Failed to load session review');
    }
  }, []);

  const pollStatus = useCallback(
    (id: number) => {
      clearPolling();
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await sessionsApi.getStatus(id);
          setStatus(res.status);
          if (res.status === 'reviewed' || res.status === 'finalized') {
            clearPolling();
            await loadReview(id);
          } else if (res.status === 'failed') {
            clearPolling();
            setError(res.error_detail || 'Session processing failed');
          }
        } catch (err: any) {
          clearPolling();
          setError(err.message || 'Error checking session status');
        }
      }, Config.POLL_INTERVAL_MS);
    },
    [loadReview]
  );

  useEffect(() => {
    if (sessionId) {
      setCurrentSessionId(sessionId);
      sessionsApi
        .getStatus(sessionId)
        .then((res) => {
          setStatus(res.status);
          if (res.status === 'reviewed' || res.status === 'finalized') {
            loadReview(sessionId);
          } else if (res.status === 'pending' || res.status === 'processing') {
            pollStatus(sessionId);
          } else if (res.status === 'failed') {
            setError(res.error_detail || 'Session processing failed');
          }
        })
        .catch((err) => {
          setError(err.message || 'Failed to fetch status');
        });
    }
  }, [sessionId, loadReview, pollStatus]);

  const startSession = async (
    classId: number,
    photo: LocalFile,
    sessionDate?: string
  ): Promise<number> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await sessionsApi.createSession(classId, photo, sessionDate);
      setCurrentSessionId(res.session_id);
      setStatus(res.status);

      // Cache session summary
      await cacheStorage.saveCachedSession({
        id: res.session_id,
        session_date: sessionDate || new Date().toISOString().split('T')[0],
        status: res.status,
        present_count: 0,
        absent_count: 0,
      });

      if (res.status === 'reviewed' || res.status === 'finalized') {
        await loadReview(res.session_id);
      } else if (res.status === 'failed') {
        // Backend ran in synchronous mode and processing already failed.
        try {
          const st = await sessionsApi.getStatus(res.session_id);
          setError(st.error_detail || 'Session processing failed');
        } catch {
          setError('Session processing failed');
        }
      } else {
        pollStatus(res.session_id);
      }

      return res.session_id;
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveFace = async (payload: ResolveRequest): Promise<void> => {
    if (!currentSessionId) return;
    setIsSubmitting(true);
    try {
      await sessionsApi.resolveFace(currentSessionId, payload);
      // Reload review data to get fresh face classifications and roster statuses
      await loadReview(currentSessionId);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve face');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const finalizeSession = async (): Promise<FinalizeResponse> => {
    if (!currentSessionId) throw new Error('No active session');
    setIsSubmitting(true);
    try {
      const res = await sessionsApi.finalizeSession(currentSessionId);
      setStatus(res.status);
      await loadReview(currentSessionId);

      // Update cache
      if (reviewData) {
        await cacheStorage.saveCachedSession({
          id: currentSessionId,
          session_date: reviewData.session_date,
          status: res.status,
          present_count: res.present_count,
          absent_count: res.absent_count,
        });
      }

      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to finalize session');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!currentSessionId) return;
    try {
      const res = await sessionsApi.getStatus(currentSessionId);
      setStatus(res.status);
      if (res.status === 'reviewed' || res.status === 'finalized') {
        await loadReview(currentSessionId);
      } else if (res.status === 'failed') {
        setError(res.error_detail || 'Session processing failed');
      }
    } catch (err: any) {
      setError(err.message || 'Error checking session status');
    }
  }, [currentSessionId, loadReview]);

  const loadAudit = async (): Promise<AuditLogOut[]> => {
    if (!currentSessionId) return [];
    try {
      const logs = await sessionsApi.getAudit(currentSessionId);
      setAuditLogs(logs);
      return logs;
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
      return [];
    }
  };

  return {
    sessionId: currentSessionId,
    status,
    reviewData,
    auditLogs,
    error,
    isSubmitting,
    mediaBaseUrl,
    startSession,
    resolveFace,
    finalizeSession,
    loadAudit,
    refreshStatus,
    reloadReview: () => (currentSessionId ? loadReview(currentSessionId) : Promise.resolve()),
  };
}
