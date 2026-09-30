/**
 * App Configuration and Constants
 */
import { Platform } from 'react-native';

// Default host based on platform
const getDefaultHost = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
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
  MAX_PHOTO_COUNT_ENROLL: 6,
  MIN_PHOTO_COUNT_ENROLL: 3,
};
