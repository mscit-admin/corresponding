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
  { value: 'returned', label: 'مُعادة' },
  { value: 'approved', label: 'معتمدة' },
  { value: 'rejected', label: 'مرفوضة' },
  { value: 'responded', label: 'تم الرد' },
  { value: 'closed', label: 'مغلقة' },
  { value: 'archived', label: 'مؤرشفة' },
];

// لون شارة الحالة (Tailwind classes)
export const STATUS_BADGE_CLASS: Record<string, string> = {
  new: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-amber-100 text-amber-700',
  returned: 'bg-orange-100 text-orange-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  responded: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-slate-200 text-slate-700',
  archived: 'bg-slate-100 text-slate-500',
};

// تسميات إجراءات سجل الحركة (Timeline)
export const ACTION_LABEL: Record<string, string> = {
  open: 'فتح المعاملة',
  refer: 'إحالة / تهميش',
  approve: 'اعتماد المعاملة',
  reject: 'رفض المعاملة',
  return: 'إعادة المعاملة',
  note: 'إضافة ملاحظة',
  print: 'طباعة المعاملة',
  close: 'إغلاق المعاملة',
  archive: 'أرشفة المعاملة',
};

const fromOptions = (opts: { value: string; label: string }[], v?: string) =>
  opts.find((o) => o.value === v)?.label || v || '';

export const priorityLabel = (v?: string) => fromOptions(PRIORITY_OPTIONS, v);
export const confidentialityLabel = (v?: string) => fromOptions(CONFIDENTIALITY_OPTIONS, v);
export const statusLabel = (v?: string) => fromOptions(STATUS_OPTIONS, v);
export const visibilityLabel = (v?: string) => fromOptions(VISIBILITY_OPTIONS, v);
export const actionLabel = (v?: string) => ACTION_LABEL[v || ''] || v || '';
