import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach JWT token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// =========================
// API Endpoints
// =========================

import type { LoginResponse, UserDetail, IncomingCorrespondence, PaginatedResponse, ExternalEntity, Department } from '@/types';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
};

export const usersApi = {
  me: () => api.get<UserDetail>('/users/me').then((r) => r.data),
  list: (params?: { skip?: number; take?: number }) =>
    api.get<PaginatedResponse<UserDetail>>('/users', { params }).then((r) => r.data),
};

export const incomingApi = {
  list: (params?: { skip?: number; take?: number; status?: string; search?: string; myInbox?: boolean }) =>
    api.get<PaginatedResponse<IncomingCorrespondence>>('/correspondence/incoming', { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get<IncomingCorrespondence>(`/correspondence/incoming/${id}`).then((r) => r.data),
  update: (
    id: string,
    data: {
      receivedAt?: string;
      senderEntityId?: string;
      subject?: string;
      priority?: string;
      confidentiality?: string;
      senderRefNo?: string;
      registryNo?: string;
      originalDate?: string;
      transactionType?: string;
      recipientType?: 'internal' | 'external';
      recipientName?: string;
      status?: string;
      currentOwnerId?: string;
      visibility?: string;
      visibilityDeptIds?: string[];
    },
  ) => api.patch<IncomingCorrespondence>(`/correspondence/incoming/${id}`, data).then((r) => r.data),
  route: (id: string, data: { departmentIds: string[]; note?: string }) =>
    api.post<IncomingCorrespondence>(`/correspondence/incoming/${id}/route`, data).then((r) => r.data),
  create: (data: {
    receivedAt: string;
    senderEntityId: string;
    subject: string;
    priority?: string;
    confidentiality?: string;
    senderRefNo?: string;
    registryNo?: string;
    originalDate?: string;
    transactionType?: string;
    recipientType?: 'internal' | 'external';
    recipientName?: string;
    visibility?: string;
    visibilityDeptIds?: string[];
  }) =>
    api.post<IncomingCorrespondence>('/correspondence/incoming', data).then((r) => r.data),
};

export const referenceApi = {
  entities: () => api.get<ExternalEntity[]>('/entities').then((r) => r.data),
  createEntity: (nameAr: string) => api.post<ExternalEntity>('/entities', { nameAr }).then((r) => r.data),
  departments: () => api.get<Department[]>('/departments').then((r) => r.data),
  createDepartment: (name: string) => api.post<Department>('/departments', { name }).then((r) => r.data),
};

export const attachmentsApi = {
  // Fetch an attachment as a Blob (sends the JWT via the axios interceptor)
  download: (id: string) =>
    api.get(`/attachments/${id}/download`, { responseType: 'blob' }).then((r) => r.data as Blob),
  remove: (id: string) => api.delete(`/attachments/${id}`).then((r) => r.data),
};
