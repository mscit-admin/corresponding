'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  IconHistory, IconLoader2, IconChevronRight, IconChevronLeft, IconShieldLock,
} from '@tabler/icons-react';
import { logsApi, LogEntry } from '@/lib/api';
import { formatDateTimeAr, deviceLabel } from '@/lib/utils';

type Kind = 'audit' | 'access';

const ACTION_LABELS: Record<string, string> = {
  UPDATE: 'تعديل بيانات',
  RESTORE: 'استرجاع بيانات',
  ATTACHMENT_ADDED: 'إضافة مرفق',
  ATTACHMENT_DELETED: 'حذف مرفق',
  LOGIN: 'تسجيل دخول',
  LOGIN_SUCCESS: 'تسجيل دخول',
  LOGIN_FAILED: 'محاولة دخول فاشلة',
  CORRESPONDENCE_VIEWED: 'فتح معاملة',
};

const ACTION_COLORS: Record<string, string> = {
  UPDATE: 'bg-brand-50 text-brand-700',
  RESTORE: 'bg-amber-50 text-amber-700',
  ATTACHMENT_ADDED: 'bg-green-50 text-green-700',
  ATTACHMENT_DELETED: 'bg-red-50 text-red-700',
  LOGIN: 'bg-green-50 text-green-700',
  LOGIN_SUCCESS: 'bg-green-50 text-green-700',
  LOGIN_FAILED: 'bg-red-50 text-red-700',
  CORRESPONDENCE_VIEWED: 'bg-slate-100 text-slate-700',
};

const FIELD_LABELS: Record<string, string> = {
  receivedAt: 'تاريخ الورود', registryNo: 'رقم القيد', senderEntityId: 'الجهة المرسِلة',
  senderRefNo: 'الرقم الإشاري', originalDate: 'تاريخ المستند', subject: 'الموضوع',
  transactionType: 'نوع المعاملة', priority: 'الأهمية', confidentiality: 'السرية',
  recipientType: 'نوع المُرسَل إليه', recipientName: 'المُرسَل إليه', status: 'الحالة',
  visibility: 'صلاحية المشاهدة', currentOwnerId: 'المالك الحالي',
};

const FILTERS: Record<Kind, { value: string; label: string }[]> = {
  audit: [
    { value: '', label: 'كل التعديلات' },
    { value: 'UPDATE', label: 'تعديل بيانات' },
    { value: 'RESTORE', label: 'استرجاع' },
    { value: 'ATTACHMENT_ADDED', label: 'إضافة مرفق' },
    { value: 'ATTACHMENT_DELETED', label: 'حذف مرفق' },
  ],
  access: [
    { value: '', label: 'كل أحداث الوصول' },
    { value: 'LOGIN_SUCCESS', label: 'تسجيل دخول' },
    { value: 'LOGIN_FAILED', label: 'محاولات فاشلة' },
    { value: 'CORRESPONDENCE_VIEWED', label: 'فتح معاملة' },
  ],
};

function Details({ entry }: { entry: LogEntry }) {
  if (entry.action === 'ATTACHMENT_ADDED') {
    return <span className="break-all">{entry.newValues?.originalName || '—'}</span>;
  }
  if (entry.action === 'ATTACHMENT_DELETED') {
    return <span className="break-all">{entry.oldValues?.originalName || '—'}</span>;
  }
  if (entry.action === 'UPDATE' || entry.action === 'RESTORE') {
    const fields = Object.keys(entry.newValues || {});
    const labels = fields.map((f) => FIELD_LABELS[f] || f).join('، ');
    return (
      <span>
        {labels || '—'}
        {entry.entityId ? (
          <Link href={`/inbox/${entry.entityId}`} className="text-brand-600 hover:underline ms-2">
            (معاملة #{entry.entityId})
          </Link>
        ) : null}
      </span>
    );
  }
  if (entry.action === 'CORRESPONDENCE_VIEWED' && entry.entityId) {
    return (
      <Link href={`/inbox/${entry.entityId}`} className="text-brand-600 hover:underline">
        معاملة #{entry.entityId}
      </Link>
    );
  }
  return <span className="text-slate-400">—</span>;
}

export function LogsView({ kind }: { kind: Kind }) {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);
  const take = 50;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['logs', kind, action, page],
    queryFn: () => logsApi[kind]({ action: action || undefined, skip: page * take, take }),
  });

  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : page * take + 1;
  const to = Math.min((page + 1) * take, total);
  const isAccess = kind === 'access';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
          {isAccess ? <IconShieldLock className="w-5 h-5 text-brand-600" /> : <IconHistory className="w-5 h-5 text-brand-600" />}
        </div>
        <div>
          <h1 className="text-lg font-semibold">{isAccess ? 'سجلّ الوصول والدخول' : 'سجلّ التعديلات العام'}</h1>
          <p className="text-xs text-slate-500">
            {isAccess
              ? 'من دخل النظام ومن فتح المعاملات ومتى (لمدير النظام).'
              : 'كل تعديلات البيانات والمرفقات عبر النظام (لمدير النظام).'}
          </p>
        </div>
      </div>

      <div className="card flex items-center justify-between gap-3 flex-wrap">
        <select
          className="input text-sm w-auto"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(0); }}
        >
          {FILTERS[kind].map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <div className="text-xs text-slate-500 inline-flex items-center gap-2">
          {isFetching && <IconLoader2 className="w-3.5 h-3.5 animate-spin" />}
          {total ? `عرض ${from}–${to} من ${total}` : 'لا نتائج'}
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <IconLoader2 className="w-4 h-4 animate-spin" /> جارٍ التحميل…
          </div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-sm text-slate-400">لا توجد سجلّات.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="text-right font-medium px-3 py-2">الإجراء</th>
                <th className="text-right font-medium px-3 py-2">التفاصيل</th>
                <th className="text-right font-medium px-3 py-2">المستخدم</th>
                {isAccess && <th className="text-right font-medium px-3 py-2">IP</th>}
                {isAccess && <th className="text-right font-medium px-3 py-2">الجهاز</th>}
                <th className="text-right font-medium px-3 py-2">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded ${ACTION_COLORS[e.action] || 'bg-slate-100 text-slate-700'}`}>
                      {ACTION_LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700 max-w-[22rem]"><Details entry={e} /></td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    <div className="font-medium text-slate-800">{e.actorName || 'غير معروف'}</div>
                    {e.actorDepartment && <div className="text-[10px] text-slate-400">{e.actorDepartment}</div>}
                  </td>
                  {isAccess && <td className="px-3 py-2 text-[11px] text-slate-500 font-mono whitespace-nowrap">{e.ipAddress || '—'}</td>}
                  {isAccess && (
                    <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">
                      <div>{deviceLabel(e.userAgent) || '—'}</div>
                      {e.deviceMac && <div className="font-mono text-[10px] text-slate-400">MAC: {e.deviceMac}</div>}
                      {e.deviceHost && <div className="text-[10px] text-slate-400">{e.deviceHost}</div>}
                    </td>
                  )}
                  <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">{formatDateTimeAr(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > take && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn text-sm disabled:opacity-40"
          >
            <IconChevronRight className="w-4 h-4" /> السابق
          </button>
          <span className="text-xs text-slate-500">صفحة {page + 1} من {Math.ceil(total / take)}</span>
          <button
            type="button"
            onClick={() => setPage((p) => ((p + 1) * take < total ? p + 1 : p))}
            disabled={(page + 1) * take >= total}
            className="btn text-sm disabled:opacity-40"
          >
            التالي <IconChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
