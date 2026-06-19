'use client';

import { useEffect, useState } from 'react';
import { IconScan, IconCircleCheck, IconRefresh, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { FaceCapture } from '@/components/FaceCapture';
import { faceApi } from '@/lib/api';

export default function FaceEnrollmentPage() {
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStatus = () => {
    faceApi
      .status()
      .then((s) => {
        setEnrolled(s.enrolled);
        setEnrolledAt(s.enrolledAt);
      })
      .catch(() => toast.error('تعذّر تحميل حالة بصمة الوجه'));
  };

  useEffect(loadStatus, []);

  const onCaptured = async (descriptor: number[]) => {
    setCapturing(false);
    setSaving(true);
    try {
      await faceApi.enroll(descriptor);
      toast.success('تم تسجيل بصمة الوجه بنجاح');
      loadStatus();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'تعذّر تسجيل بصمة الوجه');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('هل تريد حذف بصمة وجهك المسجّلة؟ ستحتاج لتسجيلها من جديد لاعتماد المعاملات.')) return;
    try {
      await faceApi.reset();
      toast.success('تم حذف بصمة الوجه');
      loadStatus();
    } catch {
      toast.error('تعذّر الحذف');
    }
  };

  return (
    <AuthLayout>
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <IconScan className="w-6 h-6 text-brand-600" />
          <h1 className="text-lg font-semibold text-slate-900">بصمة الوجه</h1>
        </div>

        <div className="card space-y-4">
          <p className="text-sm text-slate-600">
            بصمة الوجه مطلوبة للتحقّق من هويتك عند <span className="font-medium">اعتماد المعاملات</span>.
            تُسجَّل مرة واحدة وتُطابَق محلياً عبر الكاميرا. لا تُخزَّن صورة وجهك، بل قياسات رقمية فقط.
          </p>

          {enrolled === null ? (
            <div className="text-sm text-slate-500">جارٍ التحميل…</div>
          ) : enrolled ? (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-700 text-sm">
              <IconCircleCheck className="w-5 h-5 shrink-0" />
              <span>
                بصمة وجهك مسجّلة
                {enrolledAt ? ` منذ ${new Date(enrolledAt).toLocaleDateString('ar')}` : ''}.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
              لم تُسجّل بصمة وجهك بعد. لن تتمكّن من اعتماد المعاملات حتى تسجّلها.
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setCapturing(true)} disabled={saving} className="btn-primary flex-1">
              <IconRefresh className="w-4 h-4" />
              {enrolled ? 'إعادة تسجيل بصمة الوجه' : 'تسجيل بصمة الوجه'}
            </button>
            {enrolled && (
              <button onClick={reset} className="btn !text-red-600 hover:!bg-red-50">
                <IconTrash className="w-4 h-4" /> حذف
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            ملاحظة: التحقّق يتم في المتصفّح ويتطلّب كاميرا وإضاءة جيدة. للأنظمة المغلقة يمكن استضافة نماذج
            التعرّف على الوجه داخلياً عبر إعدادات البيئة.
          </p>
        </div>
      </div>

      {capturing && (
        <FaceCapture mode="enroll" onCapture={onCaptured} onClose={() => setCapturing(false)} />
      )}
    </AuthLayout>
  );
}
