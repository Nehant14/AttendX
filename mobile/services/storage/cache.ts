import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '@/constants/config';
import { ClassOut, StudentOut, SessionSummaryOut } from '@/types/api';

const K = Config.STORAGE_KEYS;

async function readList<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function upsert<T extends { id: number }>(key: string, item: T, max?: number) {
  const list = await readList<T>(key);
  let next = [item, ...list.filter((i) => i.id !== item.id)];
  if (max) next = next.slice(0, max);
  await AsyncStorage.setItem(key, JSON.stringify(next));
}

export const cacheStorage = {
  getBaseUrl: () => AsyncStorage.getItem(K.API_BASE_URL),
  setBaseUrl: (url: string) => AsyncStorage.setItem(K.API_BASE_URL, url),

  getCachedClasses: () => readList<ClassOut>(K.CLASSES_CACHE),
  saveCachedClass: (c: ClassOut) => upsert(K.CLASSES_CACHE, c),

  getCachedStudents: () => readList<StudentOut>(K.STUDENTS_CACHE),
  saveCachedStudent: (s: StudentOut) => upsert(K.STUDENTS_CACHE, s),

  getCachedSessions: () => readList<SessionSummaryOut>(K.SESSIONS_CACHE),
  saveCachedSession: (s: SessionSummaryOut) => upsert(K.SESSIONS_CACHE, s, 50),

  clearAllUserData: () =>
    AsyncStorage.multiRemove([K.CLASSES_CACHE, K.STUDENTS_CACHE, K.SESSIONS_CACHE]),
};