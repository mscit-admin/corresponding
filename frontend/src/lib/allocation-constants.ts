// Labels & options for the Land Allocation Committee module (لجنة التخصيص).

import type { AllocationStatus, AllocationDocType } from '@/types';

export const ALLOCATION_STATUS: Record<AllocationStatus, { text: string; class: string }> = {
  received: { text: 'وارد', class: 'badge-secondary' },
  under_review: { text: 'قيد العرض على اللجنة', class: 'badge-info' },
  missing_docs: { text: 'نواقص', class: 'badge-warning' },
  committee_approved: { text: 'وافقت اللجنة (بانتظار المجلس)', class: 'badge-info' },
  committee_rejected: { text: 'لم توافق اللجنة (بانتظار المجلس)', class: 'badge-warning' },
  approved: { text: 'معتمد - صدر قرار التخصيص', class: 'badge-success' },
  rejected: { text: 'مرفوض', class: 'badge-danger' },
};

export const allocationStatusLabel = (s?: string) =>
  (s && ALLOCATION_STATUS[s as AllocationStatus]?.text) || s || '';

export const DOC_TYPES: Record<AllocationDocType, string> = {
  kroki: 'رسم كروكي معتمد من التخطيط العمراني',
  realestate_cert: 'شهادة عقارية باسم الدولة',
  agriculture_approval: 'موافقة وزارة الزراعة (إن كان الموقع خارج المخطط)',
  field_report: 'تقرير مفصل من واقع الطبيعة من المكتب المختص',
  other: 'مستند آخر',
};

export const docTypeLabel = (t?: string) =>
  (t && DOC_TYPES[t as AllocationDocType]) || t || '';

export const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'عادي' },
  { value: 'urgent', label: 'عاجل' },
  { value: 'immediate', label: 'فوري' },
];

export const priorityLabel = (v?: string) =>
  PRIORITY_OPTIONS.find((o) => o.value === v)?.label || v || '';

// Filter chips for the list page (ordered by lifecycle).
export const STATUS_FILTERS: { value?: AllocationStatus; label: string }[] = [
  { value: undefined, label: 'الكل' },
  { value: 'received', label: 'وارد' },
  { value: 'under_review', label: 'قيد العرض' },
  { value: 'missing_docs', label: 'نواقص' },
  { value: 'committee_approved', label: 'موافقة اللجنة' },
  { value: 'committee_rejected', label: 'رفض اللجنة' },
  { value: 'approved', label: 'معتمد' },
  { value: 'rejected', label: 'مرفوض' },
];
