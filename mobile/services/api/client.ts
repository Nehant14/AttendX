/**
 * Centralized API Client for AttendX
 * Handles dynamic Base URL, JWT authentication, multipart uploads, and standardized error parsing.
 */
import { secureStorage } from '@/services/storage/secureStore';
import { cacheStorage } from '@/services/storage/cache';
import { Config } from '@/constants/config';
import { normalizeBaseUrl } from '@/utils/url';
import { mockRequest } from './mock';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  /** Use this base URL for just this call (e.g. "Test connection" before saving). */
  baseUrl?: string;
  /** Override the default timeout for this call. */
  timeoutMs?: number;
}

class ApiClient {
  private customBaseUrl: string | null = null;
  private unauthorizedHandler: (() => void) | null = null;

  async getBaseUrl(): Promise<string> {
    if (this.customBaseUrl) {
      return this.customBaseUrl;
    }
    const stored = normalizeBaseUrl(await cacheStorage.getBaseUrl());
    return stored || Config.DEFAULT_API_BASE_URL;
  }

  setBaseUrlOverride(url: string | null): void {
    this.customBaseUrl = url ? normalizeBaseUrl(url) : null;
  }

  /**
   * Called when an authenticated request comes back 401 (expired/invalid
   * token; backend tokens last 24h) so the app can sign the user out instead
   * of showing "Could not validate credentials" on every screen.
   */
  setUnauthorizedHandler(handler: (() => void) | null): void {
    this.unauthorizedHandler = handler;
  }

  private formatError(status: number, data: any): ApiError {
    let message = 'An unexpected error occurred';
    if (data) {
      if (typeof data === 'string') {
        message = data;
      } else if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        // Pydantic validation errors list
        message = data.detail.map((err: any) => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
      } else if (data.message) {
        message = data.message;
      }
    }
    return new ApiError(status, message, data);
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    if (Config.USE_MOCK) {
      const res = await mockRequest(options.method || 'GET', endpoint, options.body);
      if (res.status >= 400) throw this.formatError(res.status, res.data);
      return (res.status === 204 ? null : res.data) as T;
    }

    const baseUrl = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : await this.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    let urlString = `${baseUrl}${cleanEndpoint}`;
    if (options.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        urlString += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (!options.skipAuth) {
      const token = await secureStorage.getItem(Config.STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // If body is NOT FormData and Content-Type is not set, default to application/json
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // `params`, `skipAuth`, `baseUrl`, `timeoutMs` are ours, not fetch's.
    const { params: _params, skipAuth: _skipAuth, baseUrl: _baseUrl, timeoutMs, ...fetchOptions } = options;
    const timeout = timeoutMs ?? (isFormData ? Config.UPLOAD_TIMEOUT_MS : Config.REQUEST_TIMEOUT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(urlString, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
    } catch (networkError: any) {
      const timedOut = networkError?.name === 'AbortError';
      throw new ApiError(
        0,
        timedOut
          ? `The server at ${baseUrl} did not respond in time. Check that the backend is running and reachable.`
          : `Cannot reach the server at ${baseUrl}. Make sure the backend is running, your phone is on the same Wi-Fi as the computer, and the computer's firewall allows port 8000.`
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 && !options.skipAuth) {
      this.unauthorizedHandler?.();
    }

    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch {
        try {
          errorData = await response.text();
        } catch {
          // ignore
        }
      }
      throw this.formatError(response.status, errorData);
    }

    // 204 No Content
    if (response.status === 204) {
      return null as unknown as T;
    }

    try {
      const json = await response.json();
      return json as T;
    } catch {
      return null as unknown as T;
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async postForm<T>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
    });
  }

  // Get full media URL for crops and classroom photos
  async getMediaUrl(pathOrUrl: string): Promise<string> {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    const baseUrl = await this.getBaseUrl();
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${baseUrl}${cleanPath}`;
  }
}

export const apiClient = new ApiClient();