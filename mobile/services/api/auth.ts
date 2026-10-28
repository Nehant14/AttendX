/**
 * Auth & Connection API Service
 */
import { apiClient } from './client';
import { LoginRequest, ProfessorCreate, TokenResponse, HealthResponse } from '@/types/api';

export interface HealthCheckResult {
  ok: boolean;
  status: string;
  latencyMs: number;
  url: string;
  error?: string;
}

export const authApi = {
  async signup(data: ProfessorCreate): Promise<TokenResponse> {
    return apiClient.post<TokenResponse>('/auth/signup', data, { skipAuth: true });
  },

  async login(data: LoginRequest): Promise<TokenResponse> {
    return apiClient.post<TokenResponse>('/auth/login', data, { skipAuth: true });
  },

  async healthCheck(): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>('/health', { skipAuth: true });
  },

  async checkHealthDetail(): Promise<HealthCheckResult> {
    const baseUrl = await apiClient.getBaseUrl();
    const startTime = Date.now();
    try {
      const res = await apiClient.get<HealthResponse>('/health', { skipAuth: true });
      const latencyMs = Date.now() - startTime;
      if (res && res.status === 'ok') {
        return {
          ok: true,
          status: res.status,
          latencyMs,
          url: baseUrl,
        };
      }
      return {
        ok: false,
        status: (res as any)?.status || 'invalid_response',
        latencyMs,
        url: baseUrl,
        error: 'Backend returned an unexpected payload.',
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        ok: false,
        status: 'disconnected',
        latencyMs,
        url: baseUrl,
        error: err.message || 'Cannot reach server. Verify network connection and host URL.',
      };
    }
  },
};
