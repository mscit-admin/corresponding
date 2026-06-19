'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertTriangle, IconWorld, IconCheck, IconX, IconLock, IconLockOpen, IconRefresh,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { externalRequestsApi, type ExternalRequest } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'مقبول',
  denied: 'مرفوض',
  expired: 'منتهٍ',
};
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-500',
};

// خيارات مدة السماح بالساعات (0 = مفتوح)
const DURATIONS = [
  { h: 0, label: 'مفتوح' },
  { h: 4, label: '4 ساعات' },
  { h: 8, label: '8 ساعات' },
  { h: 24, label: 'يوم' },
  { h: 168, label: 'أسبوع' },
];

export default function ExternalRequestsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const allowed = user?.roleName === 'super_admin';

  const [rows, setRows] = useState<ExternalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [hours, setHours] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    setLoading(true);
    externalRequestsApi
      .list()
      .then(setRows)
      .catch(() => toast.error('تعذّر تحميل الطلبات'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const approve = async (r: ExternalRequest) => {
    setBusy(r.id);
    try {
      await externalRequestsApi.approve(r.id, hours[r.id] ?? 0);
      toast.success('تمت الموافقة على الطلب');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'تعذّر تنفيذ العملية');
    } finally {
      setBusy(null);
    }
  };

  const deny = async (r: ExternalRequest) => {
    setBusy(r.id);
    try {
      await externalRequestsApi.deny(r.id);
      toast.success('تم رفض الطلب');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'تعذّر تنفيذ العملية');
    } finally {
      setBusy(null);
    }
  };

  const toggleLock = async (r: ExternalRequest) => {
    if (!r.userId) return;
    setBusy(r.id);
    try {
      await externalRequestsApi.setLock(r.userId, !r.externalLocked);
      toast.success(r.externalLocked ? 'تم فتح الدخول الخارجي للمستخدم' : 'تم قفل الدخول الخارجي للمستخدم');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'تعذّر تنفيذ العملية');
    } finally {
      setBusy(null);
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
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconWorld className="w-6 h-6 text-brand-600" />
            <h1 className="text-lg font-semibold text-slate-900">طلبات الدخول الخارجي</h1>
          </div>
          <button onClick={load} className="btn text-sm"><IconRefresh className="w-4 h-4" /> تحديث</button>
        </div>

        {loading ? (
          <div className="card text-center py-10 text-sm text-slate-500">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="card text-center py-10 text-sm text-slate-500">لا توجد طلبات.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{r.employeeName || '—'}</div>
                    <div className="text-xs text-slate-500">
                      الرقم الوظيفي: {r.jobNo || '—'} · الإدارة: {r.department || '—'}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      IP: {r.ipAddress || '—'}{r.deviceHost ? ` · ${r.deviceHost}` : ''}
                      {r.grantType === 'until' && r.grantUntil ? ` · ينتهي: ${new Date(r.grantUntil).toLocaleString('ar')}` : ''}
                      {r.grantType === 'open' ? ' · صلاحية مفتوحة' : ''}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASS[r.status]}`}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                    {r.externalLocked && (
                      <span className="text-[11px] text-red-600 flex items-center gap-1"><IconLock className="w-3 h-3" /> مقفول خارجياً</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                  {r.status === 'pending' && (
                    <>
                      <select
                        value={hours[r.id] ?? 0}
                        onChange={(e) => setHours((h) => ({ ...h, [r.id]: Number(e.target.value) }))}
                        className="input !w-auto text-sm py-1.5"
                      >
                        {DURATIONS.map((d) => (
                          <option key={d.h} value={d.h}>{d.label}</option>
                        ))}
                      </select>
                      <button onClick={() => approve(r)} disabled={busy === r.id} className="btn text-sm !text-emerald-700">
                        <IconCheck className="w-4 h-4" /> موافقة
                      </button>
                      <button onClick={() => deny(r)} disabled={busy === r.id} className="btn text-sm !text-red-700">
                        <IconX className="w-4 h-4" /> رفض
                      </button>
                    </>
                  )}
                  {r.userId && (
                    <button
                      onClick={() => toggleLock(r)}
                      disabled={busy === r.id}
                      className={`btn text-sm ${r.externalLocked ? '!text-emerald-700' : '!text-red-700'}`}
                    >
                      {r.externalLocked ? <IconLockOpen className="w-4 h-4" /> : <IconLock className="w-4 h-4" />}
                      {r.externalLocked ? 'فتح الدخول الخارجي' : 'قفل الدخول الخارجي'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
