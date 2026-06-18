'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconHistory, IconLoader2, IconPencil, IconPaperclip, IconTrash, IconArrowLeft,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { incomingApi, AuditEntry } from '@/lib/api';
import { formatDateTimeAr } from '@/lib/utils';

const FIELD_LABELS: Record<string, string> = {
  receivedAt: 'تاريخ الورود',
  registryNo: 'رقم القيد',
  senderEntityId: 'الجهة المرسِلة',
  senderRefNo: 'الرقم الإشاري للجهة',
  originalDate: 'تاريخ المستند',
  subject: 'الموضوع',
  transactionType: 'نوع المعاملة',
  priority: 'درجة الأهمية',
  confidentiality: 'درجة السرية',
  recipientType: 'نوع المُرسَل إليه',
  recipientName: 'المُرسَل إليه',
  status: 'الحالة',
  visibility: 'صلاحية المشاهدة',
  currentOwnerId: 'المالك الحالي',
};

// قيم enum شائعة → عربية (يُستخدم الخام إن لم تُعرف)
const ENUM_LABELS: Record<string, string> = {
  normal: 'عادي', urgent: 'عاجل', very_urgent: 'عاجل جداً', flash: 'فوري',
  public: 'عام', confidential: 'سري', secret: 'سري', top_secret: 'سري للغاية',
  internal: 'داخلي', external: 'خارجي',
  all: 'الجميع', departments: 'إدارات محددة', restricted: 'منع على الكل',
  registered: 'مسجّلة', in_progress: 'قيد المعالجة', referred: 'محالة',
  approved: 'معتمدة', rejected: 'مرفوضة', closed: 'مغلقة', archived: 'مؤرشفة',
};

const DATE_FIELDS = ['receivedAt', 'originalDate'];

function formatBytes(n?: number): string {
  const b = Number(n || 0);
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeLabel(mime?: string): string {
  if (!mime) return 'ملف';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'صورة';
  if (mime.includes('word') || mime === 'application/msword') return 'Word';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'Excel';
  return 'ملف';
}

function fmtValue(field: string, val: any): string {
  if (val === null || val === undefined || val === '') return '—';
  const s = String(val);
  if (DATE_FIELDS.includes(field)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return formatDateTimeAr(s);
  }
  return ENUM_LABELS[s] || s;
}

function ActionHeader({ entry }: { entry: AuditEntry }) {
  if (entry.action === 'ATTACHMENT_ADDED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-green-700">
        <IconPaperclip className="w-4 h-4" /> إضافة مرفق
      </span>
    );
  }
  if (entry.action === 'ATTACHMENT_DELETED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-700">
        <IconTrash className="w-4 h-4" /> حذف مرفق
      </span>
    );
  }
  if (entry.action === 'RESTORE') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-700">
        <IconArrowBackUp className="w-4 h-4" /> استرجاع بيانات
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-brand-700">
      <IconPencil className="w-4 h-4" /> تعديل بيانات
    </span>
  );
}

function EntryBody({ entry }: { entry: AuditEntry }) {
  if (entry.action === 'ATTACHMENT_ADDED') {
    return (
      <div className="text-xs bg-green-50 border border-green-100 rounded-md p-2.5 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">اسم المستند:</span>
          <span className="font-semibold text-slate-800 break-all">{entry.newValues?.originalName || '—'}</span>
        </div>
        <div className="text-[11px] text-slate-500">
          النوع: <span className="font-medium">{mimeLabel(entry.newValues?.mimeType)}</span>
          {' · '}الحجم: <span className="font-medium">{formatBytes(entry.newValues?.fileSize)}</span>
        </div>
      </div>
    );
  }
  if (entry.action === 'ATTACHMENT_DELETED') {
    return (
      <div className="text-xs bg-red-50 border border-red-100 rounded-md p-2.5">
        <span className="text-slate-500">المستند المحذوف: </span>
        <span className="font-semibold text-slate-800 break-all">{entry.oldValues?.originalName || '—'}</span>
      </div>
    );
  }
  // UPDATE / RESTORE — اعرض الحقول المتغيّرة (السابق ← الجديد) بوضوح
  const fields = Object.keys(entry.newValues || {});
  if (!fields.length) return <div className="text-xs text-slate-400">لا تفاصيل</div>;
  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <div key={f} className="text-xs bg-slate-50 rounded-md p-2.5">
          <div className="font-semibold text-slate-700 mb-1.5">{FIELD_LABELS[f] || f}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] text-slate-500">السابق:</span>
            <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100 line-through decoration-1">
              {fmtValue(f, entry.oldValues?.[f])}
            </span>
            <IconArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-500">الجديد:</span>
            <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-100 font-medium">
              {fmtValue(f, entry.newValues?.[f])}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

const ACCENT: Record<string, string> = {
  ATTACHMENT_ADDED: 'border-r-green-400',
  ATTACHMENT_DELETED: 'border-r-red-400',
  RESTORE: 'border-r-amber-400',
  UPDATE: 'border-r-brand-400',
};

/** سجلّ التعديلات التفصيلي — يظهر لمدير النظام فقط. */
export function ChangeLog({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['incoming-audit', id],
    queryFn: () => incomingApi.audit(id),
  });

  const restore = useMutation({
    mutationFn: (auditId: string) => incomingApi.restoreAudit(id, auditId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incoming', id] });
      qc.invalidateQueries({ queryKey: ['incoming-audit', id] });
      toast.success('تم استرجاع البيانات إلى الحالة السابقة');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'تعذّر الاسترجاع'),
  });

  return (
    <div className="card">
      <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
        <IconHistory className="w-4 h-4 text-slate-400" /> سجلّ التعديلات (لمدير النظام)
        {data?.length ? <span className="text-slate-400 font-normal">({data.length})</span> : null}
      </h2>

      {isLoading ? (
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ التحميل…
        </div>
      ) : !data?.length ? (
        <p className="text-xs text-slate-400">لا توجد تعديلات مسجّلة على هذه المراسلة.</p>
      ) : (
        <div className="space-y-3">
          {data.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-lg border border-slate-200 border-r-4 ${ACCENT[entry.action] || 'border-r-slate-300'} bg-white p-3 space-y-2`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold"><ActionHeader entry={entry} /></div>
                {(entry.action === 'UPDATE' || entry.action === 'RESTORE') && entry.oldValues && Object.keys(entry.oldValues).length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('استرجاع البيانات إلى ما كانت عليه قبل هذا التعديل؟')) restore.mutate(entry.id);
                    }}
                    disabled={restore.isPending}
                    className="text-[11px] text-white bg-brand-600 hover:bg-brand-700 rounded px-2 py-1 inline-flex items-center gap-1 disabled:opacity-50"
                    title="الرجوع لهذه الحالة"
                  >
                    <IconArrowBackUp className="w-3.5 h-3.5" /> استرجاع
                  </button>
                )}
              </div>

              <EntryBody entry={entry} />

              <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <span>
                  بواسطة: <span className="font-medium text-slate-700">{entry.actorName || 'غير معروف'}</span>
                  {entry.actorDepartment ? ` · ${entry.actorDepartment}` : ''}
                </span>
                <span>{formatDateTimeAr(entry.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
