import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '@/services/storage/secureStore';
import { cacheStorage } from '@/services/storage/cache';
import { authApi, HealthCheckResult } from '@/services/api/auth';
import { apiClient } from '@/services/api/client';
import { Config } from '@/constants/config';
import { normalizeBaseUrl } from '@/utils/url';
import { LoginRequest, ProfessorCreate, TokenResponse } from '@/types/api';

export type UserRole = 'professor' | 'student';

interface AuthState {
  userRole: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  professorId: number | null;
  professorName: string | null;
  studentRollNo: string | null;
  studentName: string | null;
  serverUrl: string;
  connectionStatus: 'connected' | 'disconnected' | 'testing' | 'unknown';
  connectionLatency: number | null;
  connectionError: string | null;
}

interface AuthContextType extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  signup: (data: ProfessorCreate) => Promise<void>;
  loginAsStudent: (rollNo: string, name?: string) => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  testConnection: () => Promise<HealthCheckResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    userRole: 'professor',
    isAuthenticated: false,
    isLoading: true,
    token: null,
    professorId: null,
    professorName: null,
    studentRollNo: null,
    studentName: null,
    serverUrl: Config.DEFAULT_API_BASE_URL,
    connectionStatus: 'unknown',
    connectionLatency: null,
    connectionError: null,
  });

  const testConnection = useCallback(async (): Promise<HealthCheckResult> => {
    setState((prev) => ({ ...prev, connectionStatus: 'testing' }));
    const result = await authApi.checkHealthDetail();
    setState((prev) => ({
      ...prev,
      connectionStatus: result.ok ? 'connected' : 'disconnected',
      connectionLatency: result.latencyMs,
      connectionError: result.error || null,
      serverUrl: result.url,
    }));
    return result;
  }, []);

  const loadStoredAuth = useCallback(async () => {
    try {
      const [token, profileJson, storedRole, studentJson, rawStoredUrl] = await Promise.all([
        secureStorage.getItem(Config.STORAGE_KEYS.AUTH_TOKEN),
        secureStorage.getItem(Config.STORAGE_KEYS.USER_PROFILE),
        AsyncStorage.getItem(Config.STORAGE_KEYS.USER_ROLE),
        AsyncStorage.getItem(Config.STORAGE_KEYS.STUDENT_SESSION),
        cacheStorage.getBaseUrl(),
      ]);

      // First launch: nothing saved yet, fall back to the default so the
      // Settings screen always has a real string to edit.
      const serverUrl = normalizeBaseUrl(rawStoredUrl) || Config.DEFAULT_API_BASE_URL;

      const role: UserRole = storedRole === 'student' ? 'student' : 'professor';
      let studentRollNo: string | null = null;
      let studentName: string | null = null;

      if (studentJson) {
        try {
          const s = JSON.parse(studentJson);
          studentRollNo = s.roll_no;
          studentName = s.name;
        } catch {
          // ignore
        }
      }

      let professorId: number | null = null;
      let professorName: string | null = null;
      if (profileJson) {
        try {
          const p = JSON.parse(profileJson);
          professorId = p.professorId;
          professorName = p.name;
        } catch {
          // ignore
        }
      }

      const isAuthed = role === 'student' ? !!studentRollNo : !!token;

      setState((prev) => ({
        ...prev,
        userRole: role,
        isAuthenticated: isAuthed,
        isLoading: false,
        token: token || null,
        professorId,
        professorName,
        studentRollNo,
        studentName,
        serverUrl,
      }));
    } catch (e) {
      console.warn('Failed to load stored auth:', e);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    loadStoredAuth().then(() => {
      // Auto test connection in the background on startup
      testConnection().catch(() => {});
    });
  }, [loadStoredAuth, testConnection]);

  const handleTokenResponse = async (res: TokenResponse) => {
    await secureStorage.setItem(Config.STORAGE_KEYS.AUTH_TOKEN, res.access_token);
    const profile = { professorId: res.professor_id, name: res.name };
    await secureStorage.setItem(Config.STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    await AsyncStorage.setItem(Config.STORAGE_KEYS.USER_ROLE, 'professor');

    const rawUrl = await cacheStorage.getBaseUrl();
    const serverUrl = normalizeBaseUrl(rawUrl) || Config.DEFAULT_API_BASE_URL;
    setState((prev) => ({
      ...prev,
      userRole: 'professor',
      isAuthenticated: true,
      isLoading: false,
      token: res.access_token,
      professorId: res.professor_id,
      professorName: res.name,
      serverUrl,
    }));
  };

  const login = async (data: LoginRequest) => {
    const res = await authApi.login(data);
    await handleTokenResponse(res);
  };

  const signup = async (data: ProfessorCreate) => {
    const res = await authApi.signup(data);
    await handleTokenResponse(res);
  };

  const loginAsStudent = async (rollNo: string, name?: string) => {
    const cleanRoll = rollNo.trim().toUpperCase();
    const studentData = { roll_no: cleanRoll, name: name || `Student ${cleanRoll}` };
    await AsyncStorage.setItem(Config.STORAGE_KEYS.STUDENT_SESSION, JSON.stringify(studentData));
    await AsyncStorage.setItem(Config.STORAGE_KEYS.USER_ROLE, 'student');

    setState((prev) => ({
      ...prev,
      userRole: 'student',
      isAuthenticated: true,
      studentRollNo: cleanRoll,
      studentName: studentData.name,
    }));
  };

  const switchRole = async (newRole: UserRole) => {
    await AsyncStorage.setItem(Config.STORAGE_KEYS.USER_ROLE, newRole);
    setState((prev) => ({
      ...prev,
      userRole: newRole,
      isAuthenticated: newRole === 'student' ? !!prev.studentRollNo : !!prev.token,
    }));
  };

  const logout = useCallback(async () => {
    await secureStorage.removeItem(Config.STORAGE_KEYS.AUTH_TOKEN);
    await secureStorage.removeItem(Config.STORAGE_KEYS.USER_PROFILE);
    await AsyncStorage.removeItem(Config.STORAGE_KEYS.USER_ROLE);
    await AsyncStorage.removeItem(Config.STORAGE_KEYS.STUDENT_SESSION);

    const rawUrl = await cacheStorage.getBaseUrl();
    const serverUrl = normalizeBaseUrl(rawUrl) || Config.DEFAULT_API_BASE_URL;
    setState((prev) => ({
      ...prev,
      userRole: 'professor',
      isAuthenticated: false,
      isLoading: false,
      token: null,
      professorId: null,
      professorName: null,
      studentRollNo: null,
      studentName: null,
      serverUrl,
    }));
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
    await testConnection();
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        loginAsStudent,
        switchRole,
        logout,
        setServerUrl,
        testConnection,
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
