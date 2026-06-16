'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import { useState } from 'react';
import Link from 'next/link';
import {
  IconArrowRight, IconBook, IconPlus, IconCalendar, IconCircleCheck, IconFiles,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { minutesApi } from '@/lib/api';
import { formatDateAr } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { canEditCorrespondence } from '@/lib/permissions';

function MinutesListInner() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage = canEditCorrespondence(user?.roleName);
  const { data, isLoading } = useQuery({ queryKey: ['minutes'], queryFn: minutesApi.list });

  const [minutesNo, setMinutesNo] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);

  const create = useMutation({
    mutationFn: () => minutesApi.create({ minutesNo, meetingDate: new Date(meetingDate).toISOString(), notes: notes || undefined }),
    onSuccess: () => {
      toast.success('تم إنشاء المحضر');
      setMinutesNo(''); setNotes(''); setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['minutes'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'تعذّر إنشاء المحضر'),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Link href="/allocation" className="btn text-xs py-1.5"><IconArrowRight className="w-3.5 h-3.5" /> رجوع</Link>
        <span className="text-slate-400">الرئيسية › لجنة التخصيص › <span className="text-slate-900 font-medium">محاضر اللجنة</span></span>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2"><IconBook className="w-5 h-5" /> محاضر اللجنة</h1>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary"><IconPlus className="w-4 h-4" /> محضر جديد</button>
        )}
      </div>

      {showForm && canManage && (
        <div className="card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">رقم المحضر <span className="text-red-500">*</span></label>
              <input className="input" value={minutesNo} onChange={(e) => setMinutesNo(e.target.value)} placeholder="مثال: محضر 2026/3" />
            </div>
            <div>
              <label className="label">تاريخ الاجتماع <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">ملاحظات</label>
              <textarea rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn text-sm">إلغاء</button>
            <button onClick={() => create.mutate()} disabled={!minutesNo || create.isPending} className="btn-primary text-sm disabled:opacity-50">
              {create.isPending ? 'جارٍ الحفظ...' : 'حفظ المحضر'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-center py-10 text-slate-500">جارٍ التحميل...</div>}

      {data && data.length === 0 && (
        <div className="card text-center py-14">
          <IconBook className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">لا توجد محاضر بعد</p>
        </div>
      )}

      <div className="space-y-2">
        {data?.map((m) => (
          <Link key={m.id} href={`/allocation/minutes/${m.id}`} className="card flex items-center justify-between gap-3 hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <IconBook className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{m.minutesNo}</div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><IconCalendar className="w-3.5 h-3.5" /> {formatDateAr(m.meetingDate)}</span>
                  <span className="inline-flex items-center gap-1"><IconFiles className="w-3.5 h-3.5" /> {m._count?.requests ?? 0} طلب</span>
                </div>
              </div>
            </div>
            {m.status === 'cabinet_approved'
              ? <span className="badge-success inline-flex items-center gap-1"><IconCircleCheck className="w-3 h-3" /> معتمد من المجلس</span>
              : <span className="badge-secondary">مسودة</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function MinutesListPage() {
  return (
    <AuthLayout>
      <MinutesListInner />
    </AuthLayout>
  );
}
