'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import Link from 'next/link';
import {
  IconInbox, IconClock, IconAlertTriangle, IconCheck, IconArrowLeft,
  IconPlus, IconSearch, IconBuilding, IconGavel,
} from '@tabler/icons-react';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/react-query';
import { incomingApi } from '@/lib/api';
import { timeAgoAr } from '@/lib/utils';

function DashboardPageInner() {
  const user = useAuthStore((s) => s.user);

  const { data: recent } = useQuery({
    queryKey: ['incoming', 'recent'],
    queryFn: () => incomingApi.list({ take: 5 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">مرحباً، {user?.fullName} 👋</h1>
        <p className="text-sm text-slate-500 mt-1">إليك ملخص يومك في النظام</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
            <IconInbox className="w-4 h-4" /> إجمالي المعاملات
          </div>
          <div className="text-2xl font-semibold">{recent?.total ?? '-'}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-blue-700 mb-2">
            <IconClock className="w-4 h-4" /> تحتاج إجراء
          </div>
          <div className="text-2xl font-semibold text-blue-700">17</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-red-700 mb-2">
            <IconAlertTriangle className="w-4 h-4" /> متأخرة
          </div>
          <div className="text-2xl font-semibold text-red-700">2</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-emerald-700 mb-2">
            <IconCheck className="w-4 h-4" /> أنجزت اليوم
          </div>
          <div className="text-2xl font-semibold text-emerald-700">6</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">إجراءات سريعة</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/inbox" className="btn">
            <IconInbox className="w-4 h-4" /> صندوق الوارد
          </Link>
          <Link href="/inbox/new" className="btn-primary">
            <IconPlus className="w-4 h-4" /> تسجيل وارد جديد
          </Link>
          <Link href="/allocation" className="btn">
            <IconGavel className="w-4 h-4" /> لجنة التخصيص
          </Link>
          <button className="btn" disabled>
            <IconSearch className="w-4 h-4" /> بحث متقدم
          </button>
        </div>
      </div>

      {/* Recent Correspondence */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900">آخر المراسلات الواردة</h2>
          <Link href="/inbox" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1">
            عرض الكل <IconArrowLeft className="w-3 h-3" />
          </Link>
        </div>

        {!recent && <div className="text-sm text-slate-500 text-center py-6">جارٍ التحميل...</div>}

        {recent && recent.data.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            <IconInbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">لا توجد مراسلات بعد</p>
            <Link href="/inbox/new" className="btn-primary mt-3 inline-flex">
              <IconPlus className="w-4 h-4" /> سجّل أول مراسلة
            </Link>
          </div>
        )}

        {recent && recent.data.length > 0 && (
          <div className="space-y-2">
            {recent.data.map((item) => (
              <Link key={item.id} href={`/inbox/${item.id}`}
                className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-md transition-colors">
                <IconBuilding className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{item.subject}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span className="font-mono">{item.serialNo}</span>
                    <span>·</span>
                    <span>{item.senderEntity?.nameAr}</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{timeAgoAr(item.receivedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthLayout>
      <DashboardPageInner />
    </AuthLayout>
  );
}
