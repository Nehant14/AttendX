/**
 * App Configuration and Network Endpoints
 */
import { Platform } from 'react-native';

// Current machine Wi-Fi IP for direct physical device testing
export const DETECTED_LAN_IP = '10.181.223.245';

export const NETWORK_PRESETS = [
  {
    id: 'lan',
    name: 'Physical Device (Wi-Fi LAN)',
    url: `http://${DETECTED_LAN_IP}:8000`,
    description: `Connects phone over Wi-Fi directly to host (${DETECTED_LAN_IP}:8000)`,
  },
  {
    id: 'android-emu',
    name: 'Android Emulator',
    url: 'http://10.0.2.2:8000',
    description: 'Standard alias for Android emulator host loopback',
  },
  {
    id: 'ios-sim',
    name: 'iOS Simulator / Web',
    url: 'http://localhost:8000',
    description: 'Localhost alias for iOS simulator or desktop web',
  },
];

const getDefaultHost = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
};

export const Config = {
  DEFAULT_API_BASE_URL: getDefaultHost(),
  STORAGE_KEYS: {
    AUTH_TOKEN: 'attendx_auth_token',
    USER_PROFILE: 'attendx_user_profile',
    USER_ROLE: 'attendx_user_role', // 'professor' | 'student'
    STUDENT_SESSION: 'attendx_student_session',
    API_BASE_URL: 'attendx_api_base_url',
    CLASSES_CACHE: 'attendx_classes_cache',
    STUDENTS_CACHE: 'attendx_students_cache',
    SESSIONS_CACHE: 'attendx_sessions_cache',
  },
  POLL_INTERVAL_MS: 2000,
  CONNECTION_TIMEOUT_MS: 5000,
  MAX_PHOTO_COUNT_ENROLL: 6,
  MIN_PHOTO_COUNT_ENROLL: 3,
};
