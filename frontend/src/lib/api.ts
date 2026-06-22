import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';
import { getCachedDevice, getDeviceId } from './device';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach JWT token + device info (MAC) for audit logging
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const dev = getCachedDevice();
  if (dev.mac) config.headers['X-Device-Mac'] = dev.mac;
  if (dev.localIp) config.headers['X-Device-Local-Ip'] = dev.localIp;
  if (dev.hostname) config.headers['X-Device-Host'] = dev.hostname;
  const did = getDeviceId();
  if (did) config.headers['X-Device-Id'] = did;
  return config;
});

// Response interceptor - handle 401 (unauthorized) + انتهاء تصريح الدخول الخارجي (قفل تلقائي)
const AUTO_LOCK_CODES = ['EXTERNAL_GRANT_EXPIRED', 'EXTERNAL_LOCKED'];
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ code?: string }>) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (status === 401 || (status === 403 && code && AUTO_LOCK_CODES.includes(code))) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        if (code && AUTO_LOCK_CODES.includes(code)) {
          try { sessionStorage.setItem('gsdms-lock-reason', code); } catch { /* ignore */ }
        }
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// =========================
// API Endpoints
// =========================

import type { LoginResponse, UserDetail, IncomingCorrespondence, PaginatedResponse, ExternalEntity, Department, AttachmentView, TransactionType, AppNotification } from '@/types';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
  requestDeviceApproval: (username: string, password: string, reason: string) =>
    api
      .post<{ ok: boolean; message: string }>('/auth/request-device-approval', { username, password, reason })
      .then((r) => r.data),
  // الدخول الخارجي
  requestExternalCode: (username: string, password: string) =>
    api
      .post<{ sentTo: string; delivered: boolean; expiresInSec: number }>('/auth/external/request-code', { username, password })
      .then((r) => r.data),
  submitExternalRequest: (username: string, password: string, fullName: string, otpCode: string) =>
    api
      .post<{ ok: boolean; message: string }>('/auth/external/request', { username, password, fullName, otpCode })
      .then((r) => r.data),
};

export interface DeviceApproval {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  label: string | null;
  deviceId: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceHost: string | null;
  deviceMac: string | null;
  employeeName: string | null;
  jobNo: string | null;
  department: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export const deviceApprovalsApi = {
  list: (status?: 'pending' | 'approved' | 'rejected') =>
    api.get<DeviceApproval[]>('/auth/device-approvals', { params: status ? { status } : {} }).then((r) => r.data),
  approve: (id: string) => api.post(`/auth/device-approvals/${id}/approve`).then((r) => r.data),
  reject: (id: string) => api.post(`/auth/device-approvals/${id}/reject`).then((r) => r.data),
};

export interface ExternalRequest {
  id: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  userId: string | null;
  employeeName: string | null;
  jobNo: string | null;
  department: string | null;
  externalLocked: boolean;
  deviceId: string;
  ipAddress: string | null;
  deviceHost: string | null;
  grantType: 'open' | 'until' | null;
  grantUntil: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export const externalRequestsApi = {
  list: (status?: 'pending' | 'approved' | 'denied' | 'expired') =>
    api.get<ExternalRequest[]>('/auth/external-requests', { params: status ? { status } : {} }).then((r) => r.data),
  approve: (id: string, hours?: number) =>
    api.post(`/auth/external-requests/${id}/approve`, { hours }).then((r) => r.data),
  deny: (id: string) => api.post(`/auth/external-requests/${id}/deny`).then((r) => r.data),
  setLock: (userId: string, locked: boolean) =>
    api.post('/auth/external-lock', { userId, locked }).then((r) => r.data),
};

export type ApprovalVerifyMethod = 'face' | 'email' | 'both';

export interface AccessConfig {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
  timezone: string;
  companyCidrs: string[];
  notifyExternal: boolean;
  approvalVerifyMethod: ApprovalVerifyMethod;
}

export const otpApi = {
  method: () => api.get<{ method: ApprovalVerifyMethod }>('/otp/method').then((r) => r.data.method),
  requestApprovalCode: () =>
    api
      .post<{ sentTo: string; delivered: boolean; expiresInSec: number }>('/otp/request', { purpose: 'approve' })
      .then((r) => r.data),
};

export interface AccessPolicy {
  companyDevice: boolean;
  scheduleEnabled: boolean;
  withinHours: boolean;
  allowed: boolean;
  start: string;
  end: string;
  timezone: string;
  nowMinutes: number;
  exempt: boolean;
}

export const accessApi = {
  getSettings: () => api.get<AccessConfig>('/access/settings').then((r) => r.data),
  updateSettings: (data: Partial<AccessConfig>) =>
    api.patch<AccessConfig>('/access/settings', data).then((r) => r.data),
  policy: () => api.get<AccessPolicy>('/access/policy').then((r) => r.data),
};

export const faceApi = {
  status: () => api.get<{ enrolled: boolean; enrolledAt: string | null }>('/face/status').then((r) => r.data),
  enroll: (descriptor: number[]) =>
    api.post<{ ok: boolean; enrolledAt: string }>('/face/enroll', { descriptor }).then((r) => r.data),
  reset: () => api.delete<{ ok: boolean }>('/face/enroll').then((r) => r.data),
  verify: (descriptor: number[]) =>
    api.post<{ match: boolean; distance: number }>('/face/verify', { descriptor }).then((r) => r.data),
};

export const usersApi = {
  me: () => api.get<UserDetail>('/users/me').then((r) => r.data),
  list: (params?: { skip?: number; take?: number }) =>
    api.get<PaginatedResponse<UserDetail>>('/users', { params }).then((r) => r.data),
};

export type AiProviderKind = 'anthropic' | 'openai';

export interface AiProvider {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  enabled: boolean;
  locked: boolean;
  keyMasked: string;
}

export interface AiSettings {
  enabled: boolean;
  prompt: string;
  defaultPrompt: string;
  defaultProviderId: string | null;
  providers: AiProvider[];
  modelSuggestions: Record<AiProviderKind, { id: string; label: string }[]>;
}

export interface AiProviderInput {
  name: string;
  kind: AiProviderKind;
  baseUrl?: string;
  apiKey?: string;
  models: string[];
  defaultModel: string;
  enabled?: boolean;
}

export const aiSettingsApi = {
  get: () => api.get<AiSettings>('/ai/settings').then((r) => r.data),
  update: (data: { enabled?: boolean; prompt?: string; defaultProviderId?: string }) =>
    api.patch<AiSettings>('/ai/settings', data).then((r) => r.data),
  createProvider: (data: AiProviderInput) =>
    api.post<AiSettings>('/ai/providers', data).then((r) => r.data),
  updateProvider: (id: string, data: Partial<AiProviderInput>) =>
    api.patch<AiSettings>(`/ai/providers/${id}`, data).then((r) => r.data),
  deleteProvider: (id: string) =>
    api.delete<AiSettings>(`/ai/providers/${id}`).then((r) => r.data),
  test: (id: string, data: { kind?: AiProviderKind; baseUrl?: string; apiKey?: string; model?: string }) =>
    api.post<{ ok: boolean; message: string }>(`/ai/providers/${id}/test`, data).then((r) => r.data),
};

export interface AuditEntry {
  id: string;
  action: string;
  actorName: string | null;
  actorDepartment: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string | null;
  deviceMac?: string | null;
  deviceHost?: string | null;
  deviceId?: string | null;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  action: string;
  actorName: string | null;
  actorDepartment: string | null;
  entityType: string | null;
  entityId: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  ipAddress: string;
  userAgent?: string | null;
  deviceMac?: string | null;
  deviceHost?: string | null;
  deviceId?: string | null;
  createdAt: string;
}

export interface LogResult {
  total: number;
  skip: number;
  take: number;
  items: LogEntry[];
}

export const logsApi = {
  audit: (params?: { action?: string; skip?: number; take?: number }) =>
    api.get<LogResult>('/logs/audit', { params }).then((r) => r.data),
  access: (params?: { action?: string; skip?: number; take?: number }) =>
    api.get<LogResult>('/logs/access', { params }).then((r) => r.data),
};

export interface IncomingSearchParams {
  skip?: number;
  take?: number;
  status?: string;
  search?: string;
  myInbox?: boolean;
  // البحث المتقدّم
  serialNo?: string;
  subject?: string;
  senderEntityId?: string;
  userQuery?: string;
  transactionType?: string;
  dateFrom?: string;
  dateTo?: string;
  hasAttachments?: boolean;
  attachmentName?: string;
  ocr?: string;
}

export const incomingApi = {
  list: (params?: IncomingSearchParams) =>
    api.get<PaginatedResponse<IncomingCorrespondence>>('/correspondence/incoming', { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get<IncomingCorrespondence>(`/correspondence/incoming/${id}`).then((r) => r.data),
  audit: (id: string) =>
    api.get<AuditEntry[]>(`/correspondence/incoming/${id}/audit`).then((r) => r.data),
  restoreAudit: (id: string, auditId: string) =>
    api.post(`/correspondence/incoming/${id}/audit/${auditId}/restore`).then((r) => r.data),
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
  // إجراءات إدارة المعاملة: approve | reject | return | note | print | close | archive
  // الاعتماد (approve) يتطلّب تحقّقاً: رمز بريد (otpCode) أو بصمة وجه (faceDescriptor)
  act: (
    id: string,
    action: string,
    note?: string,
    verify?: { faceDescriptor?: number[]; otpCode?: string },
  ) =>
    api
      .post<IncomingCorrespondence>(`/correspondence/incoming/${id}/${action}`, {
        note,
        faceDescriptor: verify?.faceDescriptor,
        otpCode: verify?.otpCode,
      })
      .then((r) => r.data),
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

export const notificationsApi = {
  list: (unreadOnly?: boolean) =>
    api
      .get<AppNotification[]>('/notifications', { params: unreadOnly ? { unread: 'true' } : {} })
      .then((r) => r.data),
  unreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data.count),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
};

export const referenceApi = {
  entities: () => api.get<ExternalEntity[]>('/entities').then((r) => r.data),
  createEntity: (nameAr: string) => api.post<ExternalEntity>('/entities', { nameAr }).then((r) => r.data),
  departments: () => api.get<Department[]>('/departments').then((r) => r.data),
  createDepartment: (name: string) => api.post<Department>('/departments', { name }).then((r) => r.data),
};

export const transactionTypesApi = {
  list: () => api.get<TransactionType[]>('/transaction-types').then((r) => r.data),
  create: (name: string) => api.post<TransactionType>('/transaction-types', { name }).then((r) => r.data),
  update: (id: string, name: string) =>
    api.patch<TransactionType>(`/transaction-types/${id}`, { name }).then((r) => r.data),
  remove: (id: string) => api.delete(`/transaction-types/${id}`).then((r) => r.data),
};

export const attachmentsApi = {
  // Fetch an attachment as a Blob (sends the JWT via the axios interceptor)
  download: (id: string) =>
    api.get(`/attachments/${id}/download`, { responseType: 'blob' }).then((r) => r.data as Blob),
  // Fetch a previewable version (Word/Excel converted to PDF on the server)
  preview: (id: string) =>
    api.get(`/attachments/${id}/preview`, { responseType: 'blob' }).then((r) => r.data as Blob),
  // سجلّ من فتح المستند ومتى (متاح للأدمن الرئيسي فقط)
  views: (id: string) =>
    api.get<AttachmentView[]>(`/attachments/${id}/views`).then((r) => r.data),
  remove: (id: string) => api.delete(`/attachments/${id}`).then((r) => r.data),
};
