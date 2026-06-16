'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  IconArrowRight, IconBook, IconCalendar, IconCircleCheck, IconGavel, IconBuildingBank,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { minutesApi } from '@/lib/api';
import { formatDateAr, formatDateTimeAr } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { canEditCorrespondence } from '@/lib/permissions';
import { ALLOCATION_STATUS } from '@/lib/allocation-constants';

function MinutesDetailInner() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage = canEditCorrespondence(user?.roleName);

  const { data: m, isLoading, refetch } = useQuery({
    queryKey: ['minutes', id],
    queryFn: () => minutesApi.getById(id),
  });

  const approve = useMutation({
    mutationFn: () => minutesApi.cabinetApprove(id),
    onSuccess: () => {
      toast.success('تم اعتماد المحضر من مجلس الوزراء وحُسمت الطلبات');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['allocation'] });
      queryClient.invalidateQueries({ queryKey: ['allocation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['minutes'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'تعذّر اعتماد المحضر'),
  });

  if (isLoading) return <div className="text-center py-10 text-slate-500">جارٍ التحميل...</div>;
  if (!m) return <div className="text-center py-10 text-slate-500">المحضر غير موجود</div>;

  const approved = m.status === 'cabinet_approved';
  const requests = m.requests || [];

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link href="/allocation/minutes" className="btn text-xs py-1.5"><IconArrowRight className="w-3.5 h-3.5" /> رجوع</Link>
        <span className="text-slate-400">الرئيسية › لجنة التخصيص › محاضر اللجنة › <span className="text-slate-900 font-medium">{m.minutesNo}</span></span>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><IconBook className="w-5 h-5 text-slate-400" /> {m.minutesNo}</h1>
          {approved
            ? <span className="badge-success inline-flex items-center gap-1"><IconCircleCheck className="w-3 h-3" /> معتمد من مجلس الوزراء</span>
            : <span className="badge-secondary">مسودة</span>}
        </div>
        <div className="text-xs text-slate-500 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1"><IconCalendar className="w-3.5 h-3.5" /> اجتماع: {formatDateAr(m.meetingDate)}</span>
          {approved && m.cabinetApprovedAt && <span>اعتُمد: {formatDateTimeAr(m.cabinetApprovedAt)}</span>}
          <span>الطلبات: {requests.length}/12</span>
        </div>
        {m.notes && <p className="text-sm text-slate-700 mt-2">{m.notes}</p>}
      </div>

      {!approved && canManage && (
        <div className="card border-brand-200 bg-brand-50/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-slate-700 flex items-start gap-2">
            <IconBuildingBank className="w-5 h-5 text-brand-500 mt-0.5 shrink-0" />
            <span>عند اعتماد المحضر من مجلس الوزراء، تُحوّل الطلبات الموافَق عليها إلى «صدور قرار تخصيص» وغير الموافَق عليها إلى «مرفوض» تلقائياً.</span>
          </div>
          <button
            onClick={() => { if (confirm('تأكيد اعتماد المحضر من مجلس الوزراء؟ لا يمكن التراجع.')) approve.mutate(); }}
            disabled={approve.isPending || requests.length === 0}
            className="btn-primary text-sm disabled:opacity-50"
          >
            <IconCircleCheck className="w-4 h-4" /> {approve.isPending ? 'جارٍ الاعتماد...' : 'اعتماد من مجلس الوزراء'}
          </button>
        </div>
      )}

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2"><IconGavel className="w-4 h-4 text-slate-400" /> الطلبات المدرجة</h2>
        {requests.length === 0 && <p className="text-xs text-slate-400">لم تُدرج أي طلبات في هذا المحضر بعد.</p>}
        {requests
          .slice()
          .sort((a, b) => (a.minutesItemNo ?? 0) - (b.minutesItemNo ?? 0))
          .map((r) => {
            const st = ALLOCATION_STATUS[r.status];
            return (
              <Link key={r.id} href={`/allocation/${r.id}`} className="flex items-center gap-3 border border-slate-200 rounded-md p-2.5 hover:bg-slate-50">
                <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
                  {r.minutesItemNo ?? '-'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900 truncate">{r.subject}</div>
                  <div className="text-[11px] text-slate-500">{r.serialNo} · {r.requestingOffice?.nameAr}</div>
                </div>
                <span className={st?.class}>{st?.text}</span>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

export default function MinutesDetailPage() {
  return (
    <AuthLayout>
      <MinutesDetailInner />
    </AuthLayout>
  );
}
