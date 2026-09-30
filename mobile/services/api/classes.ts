/**
 * Classes API Service
 */
import { apiClient } from './client';
import { ClassCreate, ClassOut, RosterAddRequest, RosterStudentOut } from '@/types/api';

export const classesApi = {
  async listClasses(): Promise<ClassOut[]> {
    return apiClient.get<ClassOut[]>('/classes');
  },

  async createClass(data: ClassCreate): Promise<ClassOut> {
    return apiClient.post<ClassOut>('/classes', data);
  },

  async addToRoster(classId: number, data: RosterAddRequest): Promise<void> {
    await apiClient.post<void>(`/classes/${classId}/roster`, data);
  },

  async getRoster(classId: number): Promise<RosterStudentOut[]> {
    return apiClient.get<RosterStudentOut[]>(`/classes/${classId}/roster`);
  },
};
