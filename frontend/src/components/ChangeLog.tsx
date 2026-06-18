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
  return (
    <span className="inline-flex items-center gap-1.5 text-brand-700">
      <IconPencil className="w-4 h-4" /> تعديل بيانات
    </span>
  );
}

function EntryBody({ entry }: { entry: AuditEntry }) {
  if (entry.action === 'ATTACHMENT_ADDED') {
    return <div className="text-xs text-slate-600">الملف: <span className="font-medium">{entry.newValues?.originalName || '—'}</span></div>;
  }
  if (entry.action === 'ATTACHMENT_DELETED') {
    return <div className="text-xs text-slate-600">الملف: <span className="font-medium">{entry.oldValues?.originalName || '—'}</span></div>;
  }
  // UPDATE — اعرض الحقول المتغيّرة (قديم ← جديد)
  const fields = Object.keys(entry.newValues || {});
  if (!fields.length) return <div className="text-xs text-slate-400">لا تفاصيل</div>;
  return (
    <div className="space-y-1.5">
      {fields.map((f) => (
        <div key={f} className="text-xs flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-slate-700">{FIELD_LABELS[f] || f}:</span>
          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 line-through decoration-1">
            {fmtValue(f, entry.oldValues?.[f])}
          </span>
          <IconArrowLeft className="w-3.5 h-3.5 text-slate-400" />
          <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700">
            {fmtValue(f, entry.newValues?.[f])}
          </span>
        </div>
      ))}
    </div>
  );
}

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
            <div key={entry.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs font-semibold"><ActionHeader entry={entry} /></div>
                <div className="flex items-center gap-2">
                  {entry.action === 'UPDATE' && entry.oldValues && Object.keys(entry.oldValues).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('استرجاع البيانات إلى ما كانت عليه قبل هذا التعديل؟')) restore.mutate(entry.id);
                      }}
                      disabled={restore.isPending}
                      className="text-[11px] text-brand-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                      title="الرجوع لهذه الحالة"
                    >
                      <IconArrowBackUp className="w-3.5 h-3.5" /> استرجاع
                    </button>
                  )}
                  <div className="text-[11px] text-slate-400">{formatDateTimeAr(entry.createdAt)}</div>
                </div>
              </div>
              <EntryBody entry={entry} />
              <div className="text-[11px] text-slate-500">
                بواسطة: <span className="font-medium">{entry.actorName || 'غير معروف'}</span>
                {entry.actorDepartment ? ` · ${entry.actorDepartment}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
