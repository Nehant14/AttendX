/**
 * App Configuration and Constants
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { normalizeBaseUrl } from '@/utils/url';

/** Port published by docker-compose for the FastAPI backend. */
const BACKEND_PORT = 8000;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Picks the backend URL used until the user saves one in Settings.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL (set at build/start time)
 *  2. While developing with `expo start`, the JS bundle is served by the same
 *     PC that runs Docker, so reuse that PC's LAN IP (this is what makes a
 *     physical phone on the same Wi-Fi "just work" in development).
 *  3. Emulator/simulator fallbacks.
 *
 * NOTE: in a release APK/IPA there is no dev server, so step 2 does not apply
 * and the user enters the PC's address once in Settings (it is persisted).
 */
const getDefaultHost = (): string => {
  const fromEnv = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  if (fromEnv) return fromEnv;

  const devServerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devServerHost && IPV4.test(devServerHost)) {
    return `http://${devServerHost}:${BACKEND_PORT}`;
  }

  if (Platform.OS === 'android') {
    // Android emulator's alias for the host machine's loopback.
    return `http://10.0.2.2:${BACKEND_PORT}`;
  }
  return `http://localhost:${BACKEND_PORT}`;
};

export const Config = {
  USE_MOCK: process.env.EXPO_PUBLIC_USE_MOCK === 'true',
  DEFAULT_API_BASE_URL: getDefaultHost(),
  STORAGE_KEYS: {
    AUTH_TOKEN: 'attendx_auth_token',
    USER_PROFILE: 'attendx_user_profile',
    API_BASE_URL: 'attendx_api_base_url',
    CLASSES_CACHE: 'attendx_classes_cache',
    STUDENTS_CACHE: 'attendx_students_cache',
    SESSIONS_CACHE: 'attendx_sessions_cache',
  },
  POLL_INTERVAL_MS: 2000,
  /** Ordinary JSON calls. */
  REQUEST_TIMEOUT_MS: 20_000,
  /** Photo uploads (enrollment / class photo) over Wi-Fi can be slow. */
  UPLOAD_TIMEOUT_MS: 180_000,
  MAX_PHOTO_COUNT_ENROLL: 6,
  MIN_PHOTO_COUNT_ENROLL: 3,
};
