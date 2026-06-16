// =========================
// API Response Types
// =========================

export type Priority = 'normal' | 'urgent' | 'immediate' | 'top_secret';
export type Confidentiality = 'normal' | 'secret' | 'top_secret';
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

export interface Department {
  id: string;
  name: string;
  code: string;
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

// =========================
// Allocation Committee (لجنة التخصيص)
// =========================

export type AllocationStatus =
  | 'received'
  | 'under_review'
  | 'missing_docs'
  | 'committee_approved'
  | 'committee_rejected'
  | 'approved'
  | 'rejected';

export type AllocationDocType =
  | 'kroki'
  | 'realestate_cert'
  | 'agriculture_approval'
  | 'field_report'
  | 'other';

export type AllocationDocStatus = 'pending' | 'received';
export type MinutesStatus = 'draft' | 'cabinet_approved';

export interface AllocationDocument {
  id: string;
  docType: AllocationDocType;
  required: boolean;
  status: AllocationDocStatus;
  notes?: string;
  receivedAt?: string;
}

export interface AllocationEvent {
  id: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  notes?: string;
  createdAt: string;
  user?: { id: string; fullName: string; username: string };
}

export interface CommitteeMinutes {
  id: string;
  minutesNo: string;
  meetingDate: string;
  status: MinutesStatus;
  notes?: string;
  cabinetApprovedAt?: string;
  createdAt: string;
  creator?: { id: string; fullName: string };
  requests?: AllocationRequest[];
  _count?: { requests: number };
}

export interface AllocationRequest {
  id: string;
  serialNo: string;
  priorityNo?: number;
  receivedAt: string;
  beneficiary?: string;
  subject: string;
  purpose?: string;
  locationDesc?: string;
  area?: string;
  isOutsidePlan: boolean;
  priority: Priority;
  status: AllocationStatus;
  incomingId?: string;
  committeeNotes?: string;
  rejectionReason?: string;
  minutesId?: string;
  minutesItemNo?: number;
  decisionNo?: string;
  decisionDate?: string;
  cabinetApprovedAt?: string;
  createdAt: string;
  updatedAt: string;
  requestingOffice?: ExternalEntity;
  minutes?: CommitteeMinutes;
  currentOwner?: { id: string; fullName: string; username: string };
  creator?: { id: string; fullName: string; username: string };
  documents?: AllocationDocument[];
  events?: AllocationEvent[];
  attachments?: Attachment[];
}

export interface AllocationStats {
  total: number;
  byStatus: Record<string, number>;
}
