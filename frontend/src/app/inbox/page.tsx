'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  IconPlus, IconFilter, IconFileText, IconBuilding, IconUser, IconCalendar,
  IconAlertTriangle, IconInbox, IconEye, IconSend, IconPrinter, IconArchive,
  IconArrowBackUp, IconCheck, IconSearch, IconX, IconPaperclip, IconEyeCheck, IconRoute,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { incomingApi } from '@/lib/api';
import { formatDateAr, timeAgoAr } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { IncomingCorrespondence } from '@/types';

const priorityLabels: Record<string, { text: string; class: string }> = {
  urgent: { text: 'عاجل', class: 'badge-warning' },
  immediate: { text: 'فوري', class: 'badge-warning' },
  top_secret: { text: 'سري', class: 'badge-danger' },
  normal: { text: 'عادي', class: 'badge-secondary' },
};

const statusLabels: Record<string, { text: string; class: string }> = {
  new: { text: 'جديد', class: 'badge-info' },
  in_progress: { text: 'قيد المعالجة', class: 'badge-warning' },
  responded: { text: 'تم الرد', class: 'badge-success' },
  closed: { text: 'مغلق', class: 'badge-secondary' },
  archived: { text: 'مؤرشف', class: 'badge-secondary' },
};

function InboxPageInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState(initialQ);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQ);

  // keep the box in sync with the header search (?q= in the URL)
  useEffect(() => {
    setSearch(searchParams.get('q') || '');
  }, [searchParams]);

  // debounce the search input so we don't query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['incoming', { filter, search: debouncedSearch }],
    queryFn: () => incomingApi.list({ take: 50, status: filter as any, search: debouncedSearch || undefined }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500 mb-1">الرئيسية › صندوق الوارد</div>
          <h1 className="text-xl font-semibold text-slate-900">صندوق الوارد {data && <span className="text-sm font-normal text-slate-500">· {data.total} معاملة</span>}</h1>
        </div>
        <Link href="/inbox/new" className="btn-primary">
          <IconPlus className="w-4 h-4" /> تسجيل وارد جديد
        </Link>
      </div>

      {/* Search box */}
      <div className="relative">
        <IconSearch className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالموضوع، الرقم التسلسلي، الجهة المرسلة، أو المرسل إليها..."
          className="input pr-10 pl-10"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="مسح البحث"
          >
            <IconX className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilter(undefined)} className={cn('text-xs px-3 py-1.5 rounded-full font-medium', !filter ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')}>
          الكل {data && `· ${data.total}`}
        </button>
        <button onClick={() => setFilter('new')} className={cn('text-xs px-3 py-1.5 rounded-full', filter === 'new' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-slate-100 text-slate-600')}>
          جديدة
        </button>
        <button onClick={() => setFilter('in_progress')} className={cn('text-xs px-3 py-1.5 rounded-full', filter === 'in_progress' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-slate-100 text-slate-600')}>
          قيد المعالجة
        </button>
        <button className="btn ml-auto text-xs py-1.5">
          <IconFilter className="w-3.5 h-3.5" /> فلاتر إضافية
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-10 text-slate-500">جارٍ تحميل المراسلات...</div>
      )}

      {data && data.data.length === 0 && debouncedSearch && (
        <div className="card text-center py-16">
          <IconSearch className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-medium text-slate-900">لا توجد نتائج</h3>
          <p className="text-sm text-slate-500 mt-1">لم نجد مراسلات تطابق «{debouncedSearch}»</p>
          <button onClick={() => setSearch('')} className="btn mt-4 inline-flex text-sm">
            <IconX className="w-4 h-4" /> مسح البحث
          </button>
        </div>
      )}

      {data && data.data.length === 0 && !debouncedSearch && (
        <div className="card text-center py-16">
          <IconInbox className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-medium text-slate-900">لا توجد مراسلات</h3>
          <p className="text-sm text-slate-500 mt-1">ابدأ بتسجيل أول مراسلة واردة</p>
          <Link href="/inbox/new" className="btn-primary mt-4 inline-flex">
            <IconPlus className="w-4 h-4" /> تسجيل وارد جديد
          </Link>
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-2">
          {data.data.map((item) => <CorrespondenceCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function CorrespondenceCard({ item }: { item: IncomingCorrespondence }) {
  const priority = priorityLabels[item.priority] || priorityLabels.normal;
  const status = statusLabels[item.status] || statusLabels.new;

  return (
    <div className="card hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-mono inline-flex items-center gap-1">
            <IconFileText className="w-3.5 h-3.5" /> {item.serialNo}
          </span>
          {item.priority !== 'normal' && <span className={priority.class}>{priority.text}</span>}
          <span className={status.class}>{status.text}</span>
          {!!item.attachmentCount && (
            <span className="badge-secondary inline-flex items-center gap-1" title="يوجد مستند مرفق">
              <IconPaperclip className="w-3 h-3" /> {item.attachmentCount}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{timeAgoAr(item.receivedAt)}</span>
      </div>

      <Link href={`/inbox/${item.id}`} className="block hover:text-brand-700 transition-colors" title="اضغط لعرض المراسلة والمستند">
        <h3 className="text-sm font-medium text-slate-900 mb-2 leading-relaxed hover:underline">{item.subject}</h3>
      </Link>

      <div className="flex flex-col gap-1 text-xs text-slate-600 mb-3">
        <div className="flex items-center gap-1.5"><IconBuilding className="w-3.5 h-3.5 text-slate-400" /><span>من: <span className="text-slate-900">{item.senderEntity?.nameAr}</span></span></div>
        {item.recipientName && (
          <div className="flex items-center gap-1.5"><IconUser className="w-3.5 h-3.5 text-slate-400" /><span>إلى: <span className="text-slate-900">{item.recipientName}</span></span></div>
        )}
        {item.routedTo?.length ? (
          <div className="flex items-center gap-1.5"><IconRoute className="w-3.5 h-3.5 text-emerald-600" /><span>التوجيه: <span className="text-slate-900">{item.routedTo.join('، ')}</span></span></div>
        ) : null}
        <div className="flex items-center gap-1.5"><IconCalendar className="w-3.5 h-3.5 text-slate-400" /><span>وردت: {formatDateAr(item.receivedAt)}</span></div>
      </div>

      {item.dueDate && (
        <div className="bg-amber-50 text-amber-700 px-3 py-2 rounded-md text-xs flex items-center gap-2 mb-3">
          <IconAlertTriangle className="w-4 h-4" />
          <span><strong>المهلة:</strong> {formatDateAr(item.dueDate)}</span>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap items-center">
        <Link href={`/inbox/${item.id}`} className="btn text-xs py-1.5"><IconEye className="w-3.5 h-3.5" /> عرض</Link>
        <button className="btn text-xs py-1.5"><IconArrowBackUp className="w-3.5 h-3.5" /> رد</button>
        <button className="btn text-xs py-1.5"><IconSend className="w-3.5 h-3.5" /> تحويل</button>
        <button className="btn text-xs py-1.5"><IconPrinter className="w-3.5 h-3.5" /> طباعة</button>
        <button className="btn text-xs py-1.5"><IconArchive className="w-3.5 h-3.5" /> أرشفة</button>
        <span
          className="text-xs py-1.5 px-2 inline-flex items-center gap-1 text-slate-500"
          title={`شاهدها ${item.viewersCount ?? 0} شخص`}
        >
          <IconEyeCheck className="w-4 h-4 text-emerald-600" /> {item.viewersCount ?? 0}
        </span>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="text-center py-10 text-slate-500">جارٍ التحميل...</div>}>
        <InboxPageInner />
      </Suspense>
    </AuthLayout>
  );
}
