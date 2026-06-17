import axios from 'axios';

export const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
export const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

function authToken(): string | null {
  const raw = typeof window !== 'undefined' ? localStorage.getItem('gsdms-auth') : null;
  return raw ? JSON.parse(raw).state?.token : null;
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1';
}

export interface SubjectExtraction {
  subject: string;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

/** هل ميزة الاستخراج بالذكاء الاصطناعي مُفعّلة على الخادم؟ */
export async function aiStatus(): Promise<boolean> {
  try {
    const res = await axios.get(`${apiBase()}/ai/status`, {
      headers: { Authorization: `Bearer ${authToken()}` },
    });
    return !!res.data?.enabled;
  } catch {
    return false;
  }
}

/** يرسل المستند للخادم لاستخراج موضوع المراسلة وملخّصها عبر الذكاء الاصطناعي. */
export async function extractSubjectAI(file: File): Promise<SubjectExtraction> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axios.post(`${apiBase()}/ai/extract-subject`, formData, {
    headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${authToken()}` },
  });
  return res.data;
}

/** Returns an error message if the file is invalid, otherwise null. */
export function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'نوع غير مدعوم (المسموح: PDF, JPG, PNG)';
  if (file.size > MAX_SIZE) return 'حجم الملف كبير جداً (الحد الأقصى 20 ميجا)';
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload a single attachment to an incoming correspondence. */
export async function uploadAttachment(correspondenceId: string, file: File): Promise<void> {
  const raw = typeof window !== 'undefined' ? localStorage.getItem('gsdms-auth') : null;
  const token = raw ? JSON.parse(raw).state?.token : null;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1';
  const formData = new FormData();
  formData.append('file', file);
  await axios.post(`${base}/attachments/upload/incoming/${correspondenceId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
  });
}

/** Upload several attachments; returns how many failed. */
export async function uploadAttachments(correspondenceId: string, files: File[]): Promise<number> {
  let failed = 0;
  for (const file of files) {
    try {
      await uploadAttachment(correspondenceId, file);
    } catch (e) {
      console.error('Upload failed:', file.name, e);
      failed += 1;
    }
  }
  return failed;
}
