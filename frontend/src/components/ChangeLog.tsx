'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconHistory, IconLoader2, IconPencil, IconPaperclip, IconTrash,
  IconArrowBackUp, IconEye, IconChevronDown, IconArrowLeft,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { incomingApi, AuditEntry } from '@/lib/api';
import { formatDateTimeAr, deviceLabel } from '@/lib/utils';

const FIELD_LABELS: Record<string, string> = {
  receivedAt: 'تاريخ الورود', registryNo: 'رقم القيد', senderEntityId: 'الجهة المرسِلة',
  senderRefNo: 'الرقم الإشاري للجهة', originalDate: 'تاريخ المستند', subject: 'الموضوع',
  transactionType: 'نوع المعاملة', priority: 'درجة الأهمية', confidentiality: 'درجة السرية',
  recipientType: 'نوع المُرسَل إليه', recipientName: 'المُرسَل إليه', status: 'الحالة',
  visibility: 'صلاحية المشاهدة', currentOwnerId: 'المالك الحالي',
};

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

// أيقونة + تسمية + لون لكل نوع حدث
function meta(action: string): { label: string; cls: string; Icon: any } {
  switch (action) {
    case 'ATTACHMENT_ADDED': return { label: 'إضافة مرفق', cls: 'text-green-700', Icon: IconPaperclip };
    case 'ATTACHMENT_DELETED': return { label: 'حذف مرفق', cls: 'text-red-700', Icon: IconTrash };
    case 'RESTORE': return { label: 'استرجاع', cls: 'text-amber-700', Icon: IconArrowBackUp };
    case 'CORRESPONDENCE_VIEWED': return { label: 'اطّلاع', cls: 'text-slate-600', Icon: IconEye };
    default: return { label: 'تعديل', cls: 'text-brand-700', Icon: IconPencil };
  }
}

/** ملخّص مختصر يظهر في السطر الواحد. */
function summary(entry: AuditEntry): string {
  if (entry.action === 'ATTACHMENT_ADDED') return entry.newValues?.originalName || 'مستند';
  if (entry.action === 'ATTACHMENT_DELETED') return entry.oldValues?.originalName || 'مستند';
  if (entry.action === 'CORRESPONDENCE_VIEWED') return 'فتح المعاملة';
  const fields = Object.keys(entry.newValues || {});
  return fields.map((f) => FIELD_LABELS[f] || f).join('، ') || '—';
}

function ChangeRow({ entry, onRestore, restoring }: {
  entry: AuditEntry; onRestore: (id: string) => void; restoring: boolean;
}) {
  const [open, setOpen] = useState(false);
  const m = meta(entry.action);
  const isEdit = entry.action === 'UPDATE' || entry.action === 'RESTORE';
  const hasDetails = isEdit && entry.newValues && Object.keys(entry.newValues).length > 0;

  return (
    <div className="border-b border-slate-100 last:border-0 py-2">
      {/* سطر مختصر */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 font-semibold shrink-0 ${m.cls}`}>
          <m.Icon className="w-3.5 h-3.5" /> {m.label}
        </span>
        <span className="text-slate-700 truncate flex-1 min-w-0">{summary(entry)}</span>

        {hasDetails && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-slate-400 hover:text-slate-600 shrink-0" title="التفاصيل">
            <IconChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
        {isEdit && hasDetails && (
          <button
            type="button"
            onClick={() => { if (confirm('استرجاع البيانات إلى ما كانت عليه قبل هذا التعديل؟')) onRestore(entry.id); }}
            disabled={restoring}
            className="shrink-0 text-brand-600 hover:text-brand-800 disabled:opacity-50"
            title="استرجاع"
          >
            <IconArrowBackUp className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* تذييل مختصر: المستخدم · IP · الوقت */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
        <span className="text-slate-500">{entry.actorName || 'غير معروف'}</span>
        {entry.ipAddress && entry.ipAddress !== '0.0.0.0' && <span className="font-mono">· {entry.ipAddress}</span>}
        {deviceLabel(entry.userAgent) && <span>· {deviceLabel(entry.userAgent)}</span>}
        <span>· {formatDateTimeAr(entry.createdAt)}</span>
      </div>

      {/* تفاصيل قابلة للطيّ (القديم ← الجديد) */}
      {open && hasDetails && (
        <div className="mt-1.5 space-y-1 bg-slate-50 rounded-md p-2">
          {Object.keys(entry.newValues || {}).map((f) => (
            <div key={f} className="text-[11px] flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-slate-700">{FIELD_LABELS[f] || f}:</span>
              <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 line-through">{fmtValue(f, entry.oldValues?.[f])}</span>
              <IconArrowLeft className="w-3 h-3 text-slate-400" />
              <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700">{fmtValue(f, entry.newValues?.[f])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** سجلّ التعديلات والاطّلاع — مختصر — يظهر لمدير النظام فقط. */
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
      <h2 className="text-sm font-medium mb-2 flex items-center gap-2">
        <IconHistory className="w-4 h-4 text-slate-400" /> سجلّ التعديلات والاطّلاع (لمدير النظام)
        {data?.length ? <span className="text-slate-400 font-normal">({data.length})</span> : null}
      </h2>

      {isLoading ? (
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ التحميل…
        </div>
      ) : !data?.length ? (
        <p className="text-xs text-slate-400">لا توجد سجلّات على هذه المراسلة.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto pe-1">
          {data.map((entry) => (
            <ChangeRow key={entry.id} entry={entry} onRestore={(aid) => restore.mutate(aid)} restoring={restore.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}
