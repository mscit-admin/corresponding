'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import {
  IconPlus, IconGavel, IconBuilding, IconCalendar, IconSearch, IconX,
  IconFileText, IconMapPin, IconClipboardList, IconEye, IconBook,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { allocationApi } from '@/lib/api';
import { formatDateAr, timeAgoAr } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { ALLOCATION_STATUS, STATUS_FILTERS, priorityLabel } from '@/lib/allocation-constants';
import type { AllocationRequest, AllocationStatus } from '@/types';

function AllocationListInner() {
  const [filter, setFilter] = useState<AllocationStatus | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['allocation', { filter, search: debounced }],
    queryFn: () => allocationApi.list({ take: 100, status: filter, search: debounced || undefined }),
  });

  const { data: stats } = useQuery({ queryKey: ['allocation-stats'], queryFn: allocationApi.stats });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            <IconGavel className="w-3.5 h-3.5" /> الرئيسية › لجنة التخصيص
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            طلبات التخصيص {stats && <span className="text-sm font-normal text-slate-500">· {stats.total} طلب</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/allocation/minutes" className="btn">
            <IconBook className="w-4 h-4" /> محاضر اللجنة
          </Link>
          <Link href="/allocation/new" className="btn-primary">
            <IconPlus className="w-4 h-4" /> طلب تخصيص جديد
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <IconSearch className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالموضوع، الرقم التسلسلي، المكتب المختص، أو الجهة المستفيدة..."
          className="input pr-10 pl-10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="مسح">
            <IconX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const count = f.value ? stats?.byStatus[f.value] : stats?.total;
          const active = filter === f.value;
          return (
            <button
              key={f.label}
              onClick={() => setFilter(f.value)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {f.label} {count != null && `· ${count}`}
            </button>
          );
        })}
      </div>

      {isLoading && <div className="text-center py-10 text-slate-500">جارٍ تحميل الطلبات...</div>}

      {data && data.data.length === 0 && (
        <div className="card text-center py-16">
          <IconGavel className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-medium text-slate-900">
            {debounced ? 'لا توجد نتائج' : 'لا توجد طلبات تخصيص'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {debounced ? `لم نجد طلبات تطابق «${debounced}»` : 'ابدأ بتسجيل أول طلب تخصيص'}
          </p>
          {!debounced && (
            <Link href="/allocation/new" className="btn-primary mt-4 inline-flex">
              <IconPlus className="w-4 h-4" /> طلب تخصيص جديد
            </Link>
          )}
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-2">
          {data.data.map((item) => <RequestCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function RequestCard({ item }: { item: AllocationRequest }) {
  const status = ALLOCATION_STATUS[item.status] || { text: item.status, class: 'badge-secondary' };
  const docs = item.documents || [];
  const requiredDocs = docs.filter((d) => d.required);
  const receivedDocs = requiredDocs.filter((d) => d.status === 'received');

  return (
    <div className="card hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-mono inline-flex items-center gap-1">
            <IconFileText className="w-3.5 h-3.5" /> {item.serialNo}
          </span>
          {item.priorityNo != null && (
            <span className="badge-secondary" title="رقم الأسبقية">أسبقية {item.priorityNo}</span>
          )}
          {item.priority !== 'normal' && <span className="badge-warning">{priorityLabel(item.priority)}</span>}
          <span className={status.class}>{status.text}</span>
          {item.minutes && (
            <span className="badge-info inline-flex items-center gap-1" title="مدرج في محضر">
              <IconBook className="w-3 h-3" /> {item.minutes.minutesNo}{item.minutesItemNo ? ` · بند ${item.minutesItemNo}` : ''}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{timeAgoAr(item.receivedAt)}</span>
      </div>

      <Link href={`/allocation/${item.id}`} className="block hover:text-brand-700 transition-colors">
        <h3 className="text-sm font-medium text-slate-900 mb-2 leading-relaxed hover:underline">{item.subject}</h3>
      </Link>

      <div className="flex flex-col gap-1 text-xs text-slate-600 mb-3">
        <div className="flex items-center gap-1.5">
          <IconBuilding className="w-3.5 h-3.5 text-slate-400" />
          <span>المكتب المختص: <span className="text-slate-900">{item.requestingOffice?.nameAr}</span></span>
        </div>
        {item.beneficiary && (
          <div className="flex items-center gap-1.5">
            <IconMapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>الجهة المستفيدة: <span className="text-slate-900">{item.beneficiary}</span></span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <IconCalendar className="w-3.5 h-3.5 text-slate-400" />
          <span>وردت: {formatDateAr(item.receivedAt)}</span>
        </div>
        {requiredDocs.length > 0 && (
          <div className="flex items-center gap-1.5">
            <IconClipboardList className="w-3.5 h-3.5 text-slate-400" />
            <span className={receivedDocs.length === requiredDocs.length ? 'text-emerald-600' : 'text-amber-600'}>
              المستندات: {receivedDocs.length}/{requiredDocs.length} مستوفاة
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <Link href={`/allocation/${item.id}`} className="btn text-xs py-1.5">
          <IconEye className="w-3.5 h-3.5" /> عرض ومعالجة
        </Link>
      </div>
    </div>
  );
}

export default function AllocationPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="text-center py-10 text-slate-500">جارٍ التحميل...</div>}>
        <AllocationListInner />
      </Suspense>
    </AuthLayout>
  );
}
