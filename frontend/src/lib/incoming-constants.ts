// Shared option lists & labels for incoming correspondence basic data.

export const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'عادي' },
  { value: 'urgent', label: 'عاجل' },
  { value: 'immediate', label: 'فوري' },
];

export const CONFIDENTIALITY_OPTIONS = [
  { value: 'normal', label: 'عادي' },
  { value: 'secret', label: 'سري' },
  { value: 'top_secret', label: 'سري للغاية' },
];

export const TRANSACTION_TYPES = [
  'كتاب رسمي',
  'تعميم',
  'طلب',
  'شكوى',
  'مذكرة',
  'تقرير',
  'فاكس',
  'أخرى',
];

export const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'الجميع', desc: 'يشاهدها كل المستخدمين' },
  { value: 'departments', label: 'إدارات معيّنة', desc: 'الإدارات المحددة فقط' },
  { value: 'private', label: 'منع على الكل', desc: 'المُدخِل والمسؤولون فقط' },
];

export const STATUS_OPTIONS = [
  { value: 'new', label: 'جديدة' },
  { value: 'in_progress', label: 'قيد المعالجة' },
  { value: 'responded', label: 'تم الرد' },
  { value: 'closed', label: 'مغلقة' },
  { value: 'archived', label: 'مؤرشفة' },
];

const fromOptions = (opts: { value: string; label: string }[], v?: string) =>
  opts.find((o) => o.value === v)?.label || v || '';

export const priorityLabel = (v?: string) => fromOptions(PRIORITY_OPTIONS, v);
export const confidentialityLabel = (v?: string) => fromOptions(CONFIDENTIALITY_OPTIONS, v);
export const statusLabel = (v?: string) => fromOptions(STATUS_OPTIONS, v);
export const visibilityLabel = (v?: string) => fromOptions(VISIBILITY_OPTIONS, v);
