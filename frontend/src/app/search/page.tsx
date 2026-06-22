'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  IconSearch, IconX, IconFileText, IconBuilding, IconCalendar, IconPaperclip,
  IconEye, IconFileSearch, IconRoute,
} from '@tabler/icons-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { incomingApi, referenceApi, type IncomingSearchParams } from '@/lib/api';
import { formatDateAr } from '@/lib/utils';

const statusLabels: Record<string, { text: string; class: string }> = {
  new: { text: 'جديد', class: 'badge-info' },
  in_progress: { text: 'قيد المعالجة', class: 'badge-warning' },
  responded: { text: 'تم الرد', class: 'badge-success' },
  closed: { text: 'مغلق', class: 'badge-secondary' },
  archived: { text: 'مؤرشف', class: 'badge-secondary' },
};

const EMPTY: IncomingSearchParams = {
  search: '', serialNo: '', subject: '', senderEntityId: '', userQuery: '',
  dateFrom: '', dateTo: '', attachmentName: '', ocr: '', hasAttachments: false,
};

export default function SearchPage() {
  // الحقول التي يكتبها المستخدم
  const [form, setForm] = useState<IncomingSearchParams>(EMPTY);
  // المعايير المُطبّقة فعلاً (عند الضغط على بحث)
  const [applied, setApplied] = useState<IncomingSearchParams | null>(null);

  const { data: entities } = useQuery({ queryKey: ['entities'], queryFn: referenceApi.entities });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', applied],
    queryFn: () => incomingApi.list({ ...applied!, take: 100 }),
    enabled: !!applied,
  });

  const set = (k: keyof IncomingSearchParams, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const hasAny = Object.entries(form).some(([k, v]) =>
    k === 'hasAttachments' ? v === true : typeof v === 'string' && v.trim() !== '',
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // نظّف القيم الفارغة
    const cleaned: IncomingSearchParams = {};
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'hasAttachments') { if (v) (cleaned as any)[k] = true; }
      else if (typeof v === 'string' && v.trim()) (cleaned as any)[k] = v.trim();
    });
    setApplied(cleaned);
  };

  const reset = () => { setForm(EMPTY); setApplied(null); };

  return (
    <AuthLayout>
      <div className="space-y-4">
        <div>
          <div className="text-xs text-slate-500 mb-1">الرئيسية › البحث المتقدّم</div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <IconFileSearch className="w-6 h-6 text-brand-600" /> البحث المتقدّم
          </h1>
        </div>

        <form onSubmit={submit} className="card space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="بحث عام">
              <input className="input" value={form.search} onChange={(e) => set('search', e.target.value)} placeholder="الموضوع/الرقم/الجهة..." />
            </Field>
            <Field label="رقم المعاملة">
              <input className="input" value={form.serialNo} onChange={(e) => set('serialNo', e.target.value)} placeholder="تسلسلي/قيد/مرجع" />
            </Field>
            <Field label="الموضوع">
              <input className="input" value={form.subject} onChange={(e) => set('subject', e.target.value)} />
            </Field>
            <Field label="الجهة">
              <select className="input" value={form.senderEntityId} onChange={(e) => set('senderEntityId', e.target.value)}>
                <option value="">— كل الجهات —</option>
                {entities?.map((en) => <option key={en.id} value={en.id}>{en.nameAr}</option>)}
              </select>
            </Field>
            <Field label="المستخدم (المُسجِّل)">
              <input className="input" value={form.userQuery} onChange={(e) => set('userQuery', e.target.value)} placeholder="الاسم أو الرقم الوظيفي" />
            </Field>
            <Field label="اسم المرفق">
              <input className="input" value={form.attachmentName} onChange={(e) => set('attachmentName', e.target.value)} placeholder="اسم الملف" />
            </Field>
            <Field label="من تاريخ (وارد)">
              <input type="date" className="input" value={form.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} />
            </Field>
            <Field label="إلى تاريخ (وارد)">
              <input type="date" className="input" value={form.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
            </Field>
            <Field label="داخل محتوى الوثائق (OCR)">
              <input className="input" value={form.ocr} onChange={(e) => set('ocr', e.target.value)} placeholder="نص داخل المستند" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit">
            <input type="checkbox" className="w-4 h-4 accent-brand-600" checked={!!form.hasAttachments} onChange={(e) => set('hasAttachments', e.target.checked)} />
            يحتوي مرفقات فقط
          </label>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!hasAny} className="btn-primary disabled:opacity-50">
              <IconSearch className="w-4 h-4" /> بحث
            </button>
            <button type="button" onClick={reset} className="btn">
              <IconX className="w-4 h-4" /> مسح
            </button>
          </div>
        </form>

        {/* النتائج */}
        {applied && (
          <div>
            {(isLoading || isFetching) && <div className="text-center py-8 text-slate-500">جارٍ البحث...</div>}
            {data && !isFetching && (
              <div className="text-sm text-slate-500 mb-2">النتائج: {data.total}</div>
            )}
            {data && data.data.length === 0 && !isFetching && (
              <div className="card text-center py-12">
                <IconSearch className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">لا توجد نتائج مطابقة لمعايير البحث.</p>
              </div>
            )}
            <div className="space-y-2">
              {data?.data.map((item) => {
                const st = statusLabels[item.status] || statusLabels.new;
                return (
                  <div key={item.id} className="card hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                      <span className="text-xs text-slate-500 font-mono inline-flex items-center gap-1">
                        <IconFileText className="w-3.5 h-3.5" /> {item.serialNo}
                      </span>
                      <div className="flex items-center gap-2">
                        {!!item.attachmentCount && (
                          <span className="badge-secondary inline-flex items-center gap-1"><IconPaperclip className="w-3 h-3" /> {item.attachmentCount}</span>
                        )}
                        <span className={st.class}>{st.text}</span>
                      </div>
                    </div>
                    <Link href={`/inbox/${item.id}`} className="block hover:text-brand-700">
                      <h3 className="text-sm font-medium text-slate-900 mb-2 leading-relaxed hover:underline">{item.subject}</h3>
                    </Link>
                    <div className="flex flex-col gap-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5"><IconBuilding className="w-3.5 h-3.5 text-slate-400" /><span>من: <span className="text-slate-900">{item.senderEntity?.nameAr}</span></span></div>
                      {item.routedTo?.length ? (
                        <div className="flex items-center gap-1.5"><IconRoute className="w-3.5 h-3.5 text-emerald-600" /><span>التوجيه: {item.routedTo.join('، ')}</span></div>
                      ) : null}
                      <div className="flex items-center gap-1.5"><IconCalendar className="w-3.5 h-3.5 text-slate-400" /><span>وردت: {formatDateAr(item.receivedAt)}</span></div>
                    </div>
                    <div className="mt-2">
                      <Link href={`/inbox/${item.id}`} className="btn text-xs py-1.5"><IconEye className="w-3.5 h-3.5" /> عرض</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
