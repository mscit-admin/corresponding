// =========================
// API Response Types
// =========================

export type Priority = 'normal' | 'urgent' | 'top_secret';
export type IncomingStatus = 'new' | 'in_progress' | 'responded' | 'closed' | 'archived';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  roleName?: string;
  department: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface UserDetail {
  id: string;
  username: string;
  email: string;
  fullName: string;
  fullNameAr?: string;
  jobTitle?: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  role: { id: string; name: string; nameAr: string };
  department: { id: string; name: string; code: string };
}

export interface ExternalEntity {
  id: string;
  name: string;
  nameAr: string;
  type: string;
}

export interface IncomingCorrespondence {
  id: string;
  serialNo: string;
  receivedAt: string;
  senderRefNo?: string;
  originalDate?: string;
  subject: string;
  priority: Priority;
  status: IncomingStatus;
  recipientType?: 'internal' | 'external';
  recipientName?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  senderEntity: ExternalEntity;
  category?: { id: string; name: string };
  currentOwner?: { id: string; fullName: string; username: string };
  creator?: { id: string; fullName: string; username: string };
  attachmentCount?: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number | string;
  uploadedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}
