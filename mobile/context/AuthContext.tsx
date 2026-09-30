import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { secureStorage } from '@/services/storage/secureStore';
import { cacheStorage } from '@/services/storage/cache';
import { authApi } from '@/services/api/auth';
import { apiClient } from '@/services/api/client';
import { Config } from '@/constants/config';
import { normalizeBaseUrl } from '@/utils/url';
import { LoginRequest, ProfessorCreate, TokenResponse } from '@/types/api';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  professorId: number | null;
  professorName: string | null;
  serverUrl: string;
}

interface AuthContextType extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  signup: (data: ProfessorCreate) => Promise<void>;
  logout: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    token: null,
    professorId: null,
    professorName: null,
    serverUrl: Config.DEFAULT_API_BASE_URL,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [token, profileJson, storedUrl] = await Promise.all([
        secureStorage.getItem(Config.STORAGE_KEYS.AUTH_TOKEN),
        secureStorage.getItem(Config.STORAGE_KEYS.USER_PROFILE),
        cacheStorage.getBaseUrl(),
      ]);
      // First launch: nothing saved yet, fall back to the default so the
      // Settings screen always has a real string to edit.
      const serverUrl = normalizeBaseUrl(storedUrl) || Config.DEFAULT_API_BASE_URL;

      if (token && profileJson) {
        const profile = JSON.parse(profileJson);
        setState({
          isAuthenticated: true,
          isLoading: false,
          token,
          professorId: profile.professorId,
          professorName: profile.name,
          serverUrl,
        });
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          serverUrl,
        }));
      }
    } catch (e) {
      console.warn('Failed to load stored auth:', e);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleTokenResponse = async (res: TokenResponse) => {
    await secureStorage.setItem(Config.STORAGE_KEYS.AUTH_TOKEN, res.access_token);
    const profile = { professorId: res.professor_id, name: res.name };
    await secureStorage.setItem(Config.STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));

    const serverUrl = normalizeBaseUrl(await cacheStorage.getBaseUrl()) || Config.DEFAULT_API_BASE_URL;
    setState({
      isAuthenticated: true,
      isLoading: false,
      token: res.access_token,
      professorId: res.professor_id,
      professorName: res.name,
      serverUrl,
    });
  };

  const login = async (data: LoginRequest) => {
    const res = await authApi.login(data);
    await handleTokenResponse(res);
  };

  const signup = async (data: ProfessorCreate) => {
    const res = await authApi.signup(data);
    await handleTokenResponse(res);
  };

  const logout = useCallback(async () => {
    await secureStorage.removeItem(Config.STORAGE_KEYS.AUTH_TOKEN);
    await secureStorage.removeItem(Config.STORAGE_KEYS.USER_PROFILE);
    await cacheStorage.clearAllUserData();

    const serverUrl = normalizeBaseUrl(await cacheStorage.getBaseUrl()) || Config.DEFAULT_API_BASE_URL;
    setState({
      isAuthenticated: false,
      isLoading: false,
      token: null,
      professorId: null,
      professorName: null,
      serverUrl,
    });
  }, []);

  // Backend tokens expire (24h). When any authenticated call gets a 401,
  // drop the stale session so the root layout sends the user to Login.
  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      logout().catch(() => {});
    });
    return () => apiClient.setUnauthorizedHandler(null);
  }, [logout]);

  const setServerUrl = async (url: string) => {
    const clean = normalizeBaseUrl(url) || Config.DEFAULT_API_BASE_URL;
    await cacheStorage.setBaseUrl(clean);
    setState((prev) => ({ ...prev, serverUrl: clean }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        logout,
        setServerUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
