'use client';

import { useRouter } from 'next/navigation';
import { IconAlertTriangle } from '@tabler/icons-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { LogsView } from '@/components/LogsView';
import { useAuthStore } from '@/store/auth';

export default function AuditLogPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const allowed = user?.roleName === 'super_admin';

  return (
    <AuthLayout>
      {allowed ? (
        <div className="max-w-5xl mx-auto">
          <LogsView kind="audit" />
        </div>
      ) : (
        <div className="card max-w-lg mx-auto text-center py-10 space-y-3">
          <IconAlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-semibold">صلاحية غير كافية</h1>
          <p className="text-sm text-slate-500">هذه الشاشة مخصّصة لمدير النظام فقط.</p>
          <button onClick={() => router.push('/dashboard')} className="btn text-sm mx-auto">العودة للرئيسية</button>
        </div>
      )}
    </AuthLayout>
  );
}
