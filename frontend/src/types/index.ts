// =========================
// API Response Types
// =========================

export type Priority = 'normal' | 'urgent' | 'immediate' | 'top_secret';
export type Confidentiality = 'normal' | 'secret' | 'top_secret';
export type Visibility = 'public' | 'departments' | 'private';
export type IncomingStatus =
  | 'new'
  | 'in_progress'
  | 'returned'
  | 'approved'
  | 'rejected'
  | 'responded'
  | 'closed'
  | 'archived';

export type IncomingActionKind =
  | 'open'
  | 'refer'
  | 'approve'
  | 'reject'
  | 'return'
  | 'note'
  | 'print'
  | 'close'
  | 'archive';

export interface IncomingActionEntry {
  id: string;
  action: IncomingActionKind;
  note?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorName?: string | null;
  actorDepartment?: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: 'transfer' | 'approval' | 'reminder' | 'system' | 'mention';
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface CorrespondenceViewer {
  userId: string;
  fullName: string;
  department?: string | null;
  lastViewedAt: string;
  viewCount: number;
}

export interface IncomingRouting {
  id: string;
  departmentId: string;
  departmentName?: string | null;
  note?: string | null;
  routedBy?: string | null;
  createdAt: string;
}

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

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface TransactionType {
  id: string;
  name: string;
}

export interface IncomingCorrespondence {
  id: string;
  serialNo: string;
  registryNo?: string;
  receivedAt: string;
  senderRefNo?: string;
  originalDate?: string;
  subject: string;
  transactionType?: string;
  priority: Priority;
  confidentiality?: Confidentiality;
  visibility?: Visibility;
  visibilityDeptIds?: string[];
  visibilityDeptNames?: string[];
  viewers?: CorrespondenceViewer[];
  routings?: IncomingRouting[];
  actions?: IncomingActionEntry[];
  routedTo?: string[];
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
  viewersCount?: number;
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

export interface AttachmentView {
  userId: string;
  fullName: string;
  department?: string | null;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}
