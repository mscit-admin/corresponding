'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertTriangle, IconDeviceDesktop, IconCheck, IconX, IconRefresh,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { deviceApprovalsApi, type DeviceApproval } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type Filter = 'pending' | 'approved' | 'rejected';

const STATUS_LABEL: Record<DeviceApproval['status'], string> = {
  pending: 'بانتظار الموافقة',
  approved: 'معتمد',
  rejected: 'مرفوض',
};

const STATUS_CLASS: Record<DeviceApproval['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function DeviceApprovalsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const allowed = user?.roleName === 'super_admin';

  const [filter, setFilter] = useState<Filter>('pending');
  const [items, setItems] = useState<DeviceApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await deviceApprovalsApi.list(filter));
    } catch {
      toast.error('تعذّر تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const decide = async (id: string, approve: boolean) => {
    setBusyId(id);
    try {
      if (approve) await deviceApprovalsApi.approve(id);
      else await deviceApprovalsApi.reject(id);
      toast.success(approve ? 'تمت الموافقة على الجهاز' : 'تم رفض الجهاز');
      await load();
    } catch {
      toast.error('تعذّر تنفيذ العملية');
    } finally {
      setBusyId(null);
    }
  };

  if (!allowed) {
    return (
      <AuthLayout>
        <div className="card max-w-lg mx-auto text-center py-10 space-y-3">
          <IconAlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-semibold">صلاحية غير كافية</h1>
          <p className="text-sm text-slate-500">هذه الشاشة مخصّصة لمدير النظام فقط.</p>
          <button onClick={() => router.push('/dashboard')} className="btn text-sm mx-auto">العودة للرئيسية</button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconDeviceDesktop className="w-6 h-6 text-brand-600" />
            <h1 className="text-lg font-semibold text-slate-900">طلبات اعتماد الأجهزة</h1>
          </div>
          <button onClick={() => void load()} className="btn text-sm" disabled={loading}>
            <IconRefresh className="w-4 h-4" /> تحديث
          </button>
        </div>

        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm ${filter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="card text-center py-10 text-sm text-slate-500">جارٍ التحميل...</div>
        ) : items.length === 0 ? (
          <div className="card text-center py-10 text-sm text-slate-500">لا توجد طلبات.</div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{it.employeeName || '—'}</div>
                    <div className="text-xs text-slate-500">
                      الرقم الوظيفي: <span className="font-mono">{it.jobNo || '—'}</span>
                      {it.department ? ` — ${it.department}` : ''}
                    </div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_CLASS[it.status]}`}>
                    {STATUS_LABEL[it.status]}
                  </span>
                </div>

                {it.reason && (
                  <div className="text-sm text-slate-700 bg-slate-50 rounded-md p-2">
                    <span className="text-slate-400 text-xs">سبب الدخول: </span>{it.reason}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                  <div>عنوان IP: <span className="font-mono text-slate-700">{it.ipAddress || '—'}</span></div>
                  <div>الجهاز: <span className="text-slate-700">{it.deviceHost || '—'}</span></div>
                  <div>التاريخ: <span className="text-slate-700">{new Date(it.createdAt).toLocaleString('ar')}</span></div>
                  <div>المعرّف: <span className="font-mono text-slate-700">{it.deviceId.slice(0, 12)}…</span></div>
                </div>
                {it.userAgent && <div className="text-[11px] text-slate-400 truncate" title={it.userAgent}>{it.userAgent}</div>}

                {it.status === 'pending' ? (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => decide(it.id, true)}
                      disabled={busyId === it.id}
                      className="btn-primary text-sm flex-1"
                    >
                      <IconCheck className="w-4 h-4" /> موافقة
                    </button>
                    <button
                      onClick={() => decide(it.id, false)}
                      disabled={busyId === it.id}
                      className="btn text-sm flex-1 !text-red-600 hover:!bg-red-50"
                    >
                      <IconX className="w-4 h-4" /> رفض
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 pt-1">
                    {it.decidedBy ? `بواسطة ${it.decidedBy}` : ''}
                    {it.decidedAt ? ` — ${new Date(it.decidedAt).toLocaleString('ar')}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
