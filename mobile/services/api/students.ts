/**
 * Students & Enrollment API Service
 */
import { Platform } from 'react-native';
import { apiClient } from './client';
import { StudentCreate, StudentOut, EnrollmentResponse, EmbeddingOut } from '@/types/api';

export interface LocalFile {
  uri: string;
  name?: string;
  type?: string;
}

export const studentsApi = {
  async createStudent(data: StudentCreate): Promise<StudentOut> {
    return apiClient.post<StudentOut>('/students', data);
  },

  async enrollStudent(rollNo: string, photos: LocalFile[]): Promise<EnrollmentResponse> {
    const formData = new FormData();

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const filename = p.name || `photo_${i + 1}.jpg`;
      const fileType = p.type || 'image/jpeg';

      if (Platform.OS === 'web') {
        // Web fetch needs a Blob if URI is a blob/data URL
        const res = await fetch(p.uri);
        const blob = await res.blob();
        formData.append('files', blob, filename);
      } else {
        // Native React Native format
        formData.append('files', {
          uri: p.uri,
          name: filename,
          type: fileType,
        } as any);
      }
    }

    return apiClient.postForm<EnrollmentResponse>(`/students/${encodeURIComponent(rollNo)}/enroll`, formData);
  },

  async getEmbeddings(rollNo: string): Promise<EmbeddingOut[]> {
    return apiClient.get<EmbeddingOut[]>(`/students/${encodeURIComponent(rollNo)}/embeddings`);
  },
};
