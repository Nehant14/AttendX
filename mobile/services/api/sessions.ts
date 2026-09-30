/**
 * Attendance Sessions API Service
 */
import { Platform } from 'react-native';
import { apiClient } from './client';
import {
  SessionCreateResponse,
  SessionStatusResponse,
  SessionReviewResponse,
  ResolveRequest,
  ResolveResponse,
  FinalizeResponse,
  AuditLogOut,
} from '@/types/api';
import { LocalFile } from './students';

export const sessionsApi = {
  async createSession(
    classId: number,
    photo: LocalFile,
    sessionDate?: string
  ): Promise<SessionCreateResponse> {
    const formData = new FormData();
    formData.append('class_id', String(classId));

    if (sessionDate) {
      formData.append('session_date', sessionDate);
    }

    const filename = photo.name || 'classroom_photo.jpg';
    const fileType = photo.type || 'image/jpeg';

    if (Platform.OS === 'web') {
      const res = await fetch(photo.uri);
      const blob = await res.blob();
      formData.append('photo', blob, filename);
    } else {
      formData.append('photo', {
        uri: photo.uri,
        name: filename,
        type: fileType,
      } as any);
    }

    return apiClient.postForm<SessionCreateResponse>('/sessions', formData);
  },

  async getStatus(sessionId: number): Promise<SessionStatusResponse> {
    return apiClient.get<SessionStatusResponse>(`/sessions/${sessionId}/status`);
  },

  async reviewSession(sessionId: number): Promise<SessionReviewResponse> {
    return apiClient.get<SessionReviewResponse>(`/sessions/${sessionId}/review`);
  },

  async resolveFace(sessionId: number, data: ResolveRequest): Promise<ResolveResponse> {
    return apiClient.post<ResolveResponse>(`/sessions/${sessionId}/resolve`, data);
  },

  async finalizeSession(sessionId: number): Promise<FinalizeResponse> {
    return apiClient.post<FinalizeResponse>(`/sessions/${sessionId}/finalize`);
  },

  async getAudit(sessionId: number): Promise<AuditLogOut[]> {
    return apiClient.get<AuditLogOut[]>(`/sessions/${sessionId}/audit`);
  },
};
