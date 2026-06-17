'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconSparkles, IconDeviceFloppy, IconPlugConnected, IconLoader2,
  IconCheck, IconX, IconAlertTriangle, IconRefresh,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useAuthStore } from '@/store/auth';
import { canManageAiSettings } from '@/lib/permissions';
import { aiSettingsApi } from '@/lib/api';

export default function AiSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const allowed = canManageAiSettings(user?.roleName);

  const { data, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: aiSettingsApi.get,
    enabled: allowed,
  });

  // حالة النموذج
  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(''); // فارغ = لا تغيير
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setModel(data.model);
      setPrompt(data.prompt);
      setApiKey('');
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      aiSettingsApi.update({
        enabled,
        model,
        prompt,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      }),
    onSuccess: (res) => {
      qc.setQueryData(['ai-settings'], res);
      qc.invalidateQueries({ queryKey: ['ai-status'] });
      setApiKey('');
      toast.success('تم حفظ الإعدادات');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'تعذّر حفظ الإعدادات'),
  });

  const clearKey = useMutation({
    mutationFn: () => aiSettingsApi.update({ clearKey: true }),
    onSuccess: (res) => {
      qc.setQueryData(['ai-settings'], res);
      qc.invalidateQueries({ queryKey: ['ai-status'] });
      setApiKey('');
      setTest(null);
      toast.success('تم حذف المفتاح');
    },
  });

  const testConn = useMutation({
    mutationFn: () => aiSettingsApi.test(apiKey.trim() || undefined),
    onSuccess: (res) => {
      setTest(res);
      res.ok ? toast.success(res.message) : toast.error(res.message);
    },
    onError: (e: any) => {
      const m = e?.response?.data?.message || 'تعذّر اختبار الاتصال';
      setTest({ ok: false, message: m });
      toast.error(m);
    },
  });

  if (!allowed) {
    return (
      <AuthLayout>
        <div className="card max-w-lg mx-auto text-center py-10 space-y-3">
          <IconAlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-semibold">صلاحية غير كافية</h1>
          <p className="text-sm text-slate-500">هذه الشاشة مخصّصة لمديري النظام فقط.</p>
          <button onClick={() => router.push('/dashboard')} className="btn text-sm mx-auto">
            العودة للرئيسية
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* العنوان */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <IconSparkles className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">إعدادات الذكاء الاصطناعي</h1>
            <p className="text-xs text-slate-500">
              التحكم في ميزة استخراج موضوع المراسلة من المستند تلقائياً (OCR).
            </p>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="card flex items-center gap-2 text-sm text-slate-500">
            <IconLoader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل الإعدادات…
          </div>
        ) : (
          <>
            {/* الحالة العامة */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-semibold">تفعيل الميزة</div>
                  <div className="text-xs text-slate-500">
                    عند الإيقاف يختفي زر الاستخراج من شاشات الإدخال في كل النظام.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled((v) => !v)}
                  disabled={!data.hasKey && !apiKey.trim()}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    enabled ? 'bg-brand-600' : 'bg-slate-300'
                  }`}
                  title={!data.hasKey && !apiKey.trim() ? 'أضِف مفتاح API أولاً' : ''}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-1' : 'translate-x-6'
                    }`}
                  />
                </button>
              </div>
              {!data.hasKey && (
                <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 flex items-center gap-2">
                  <IconAlertTriangle className="w-4 h-4 shrink-0" />
                  لا يوجد مفتاح API محفوظ — أضِف مفتاحاً أدناه لتفعيل الميزة.
                </div>
              )}
            </div>

            {/* مفتاح API */}
            <div className="card space-y-3">
              <div>
                <div className="text-sm font-semibold">مفتاح Anthropic API</div>
                <div className="text-xs text-slate-500">
                  يُحفظ بشكل آمن في قاعدة البيانات. اتركه فارغاً للإبقاء على المفتاح الحالي.
                </div>
              </div>

              {data.keyLocked ? (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-600">
                  المفتاح مضبوط حالياً عبر متغيّر البيئة على الخادم (<code>ANTHROPIC_API_KEY</code>)،
                  ولا يمكن تعديله من هنا. لإدارته من الواجهة، أزِله من متغيّرات البيئة.
                </div>
              ) : (
                <>
                  {data.hasKey && (
                    <div className="text-xs text-slate-500">
                      المفتاح الحالي: <span className="font-mono">{data.keyMasked}</span>
                    </div>
                  )}
                  <input
                    type="password"
                    autoComplete="off"
                    className="input font-mono"
                    placeholder={data.hasKey ? 'أدخِل مفتاحاً جديداً للاستبدال…' : 'sk-ant-...'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  {data.hasKey && (
                    <button
                      type="button"
                      onClick={() => clearKey.mutate()}
                      disabled={clearKey.isPending}
                      className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                    >
                      <IconX className="w-3.5 h-3.5" /> حذف المفتاح المحفوظ
                    </button>
                  )}
                </>
              )}

              {/* اختبار الاتصال */}
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => testConn.mutate()}
                  disabled={testConn.isPending || (!data.hasKey && !apiKey.trim())}
                  className="btn text-sm disabled:opacity-50"
                >
                  {testConn.isPending ? (
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <IconPlugConnected className="w-4 h-4" />
                  )}
                  اختبار الاتصال
                </button>
                {test && (
                  <span
                    className={`text-xs inline-flex items-center gap-1 ${
                      test.ok ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {test.ok ? <IconCheck className="w-4 h-4" /> : <IconX className="w-4 h-4" />}
                    {test.message}
                  </span>
                )}
              </div>
            </div>

            {/* النموذج */}
            <div className="card space-y-2">
              <div className="text-sm font-semibold">النموذج المستخدَم</div>
              <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                {data.availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                الموديلات الأدق أبطأ وأعلى تكلفة؛ اختر حسب طبيعة مستنداتكم.
              </p>
            </div>

            {/* نص التوجيه */}
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">نص التوجيه (Prompt)</div>
                <button
                  type="button"
                  onClick={() => setPrompt(data.defaultPrompt)}
                  className="text-xs text-slate-500 hover:text-brand-600 inline-flex items-center gap-1"
                >
                  <IconRefresh className="w-3.5 h-3.5" /> استعادة الافتراضي
                </button>
              </div>
              <textarea
                rows={10}
                className="input font-mono text-xs leading-relaxed"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <p className="text-[11px] text-slate-400">
                يجب أن يطلب النص ردّاً بصيغة JSON يحوي الحقول: subject و summary و confidence.
              </p>
            </div>

            {/* حفظ */}
            <div className="card flex justify-end gap-2">
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {save.isPending ? (
                  <IconLoader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <IconDeviceFloppy className="w-4 h-4" />
                )}
                حفظ الإعدادات
              </button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
