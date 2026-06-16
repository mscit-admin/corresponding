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

import type {
  LoginResponse, UserDetail, IncomingCorrespondence, PaginatedResponse, ExternalEntity, Department,
  AllocationRequest, AllocationDocument, CommitteeMinutes, AllocationStats,
} from '@/types';

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
    },
  ) => api.patch<IncomingCorrespondence>(`/correspondence/incoming/${id}`, data).then((r) => r.data),
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
  }) =>
    api.post<IncomingCorrespondence>('/correspondence/incoming', data).then((r) => r.data),
};

export const referenceApi = {
  entities: () => api.get<ExternalEntity[]>('/entities').then((r) => r.data),
  createEntity: (nameAr: string) => api.post<ExternalEntity>('/entities', { nameAr }).then((r) => r.data),
  departments: () => api.get<Department[]>('/departments').then((r) => r.data),
  createDepartment: (name: string) => api.post<Department>('/departments', { name }).then((r) => r.data),
};

export const allocationApi = {
  list: (params?: {
    skip?: number; take?: number; status?: string; priority?: string; minutesId?: string; search?: string;
  }) => api.get<PaginatedResponse<AllocationRequest>>('/allocation/requests', { params }).then((r) => r.data),
  stats: () => api.get<AllocationStats>('/allocation/requests/stats').then((r) => r.data),
  getById: (id: string) =>
    api.get<AllocationRequest>(`/allocation/requests/${id}`).then((r) => r.data),
  create: (data: {
    receivedAt: string;
    requestingOfficeId: string;
    subject: string;
    priorityNo?: string;
    beneficiary?: string;
    purpose?: string;
    locationDesc?: string;
    area?: string;
    isOutsidePlan?: boolean;
    priority?: string;
    incomingId?: string;
  }) => api.post<AllocationRequest>('/allocation/requests', data).then((r) => r.data),
  update: (id: string, data: Partial<AllocationRequest> & { requestingOfficeId?: string; priorityNo?: string }) =>
    api.patch<AllocationRequest>(`/allocation/requests/${id}`, data).then((r) => r.data),

  // workflow
  submit: (id: string, notes?: string) =>
    api.post(`/allocation/requests/${id}/submit`, { notes }).then((r) => r.data),
  markMissing: (id: string, notes?: string) =>
    api.post(`/allocation/requests/${id}/missing`, { notes }).then((r) => r.data),
  committeeDecision: (id: string, decision: 'approve' | 'reject', notes?: string) =>
    api.post(`/allocation/requests/${id}/committee-decision`, { decision, notes }).then((r) => r.data),
  assignMinutes: (id: string, minutesId: string, itemNo: number) =>
    api.post(`/allocation/requests/${id}/assign-minutes`, { minutesId, itemNo }).then((r) => r.data),
  recordDecision: (id: string, decisionNo?: string, decisionDate?: string) =>
    api.post(`/allocation/requests/${id}/decision`, { decisionNo, decisionDate }).then((r) => r.data),

  // documents checklist
  addDocument: (id: string, data: { docType: string; required?: boolean; status?: string; notes?: string }) =>
    api.post<AllocationDocument>(`/allocation/requests/${id}/documents`, data).then((r) => r.data),
  updateDocument: (
    id: string,
    docId: string,
    data: { status?: string; notes?: string; required?: boolean },
  ) => api.patch<AllocationDocument>(`/allocation/requests/${id}/documents/${docId}`, data).then((r) => r.data),
};

export const minutesApi = {
  list: () => api.get<CommitteeMinutes[]>('/allocation/minutes').then((r) => r.data),
  getById: (id: string) => api.get<CommitteeMinutes>(`/allocation/minutes/${id}`).then((r) => r.data),
  create: (data: { minutesNo: string; meetingDate: string; notes?: string }) =>
    api.post<CommitteeMinutes>('/allocation/minutes', data).then((r) => r.data),
  cabinetApprove: (id: string) =>
    api.post<CommitteeMinutes>(`/allocation/minutes/${id}/cabinet-approve`, {}).then((r) => r.data),
};

export const attachmentsApi = {
  // Fetch an attachment as a Blob (sends the JWT via the axios interceptor)
  download: (id: string) =>
    api.get(`/attachments/${id}/download`, { responseType: 'blob' }).then((r) => r.data as Blob),
  remove: (id: string) => api.delete(`/attachments/${id}`).then((r) => r.data),
};
