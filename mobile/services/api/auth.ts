/**
 * Auth API Service
 */
import { apiClient } from './client';
import { LoginRequest, ProfessorCreate, TokenResponse, HealthResponse } from '@/types/api';

export const authApi = {
  async signup(data: ProfessorCreate): Promise<TokenResponse> {
    return apiClient.post<TokenResponse>('/auth/signup', data, { skipAuth: true });
  },

  async login(data: LoginRequest): Promise<TokenResponse> {
    return apiClient.post<TokenResponse>('/auth/login', data, { skipAuth: true });
  },

  /** Pass `baseUrl` to test an address before it is saved. */
  async healthCheck(baseUrl?: string): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>('/health', { skipAuth: true, baseUrl, timeoutMs: 8_000 });
  },
};
