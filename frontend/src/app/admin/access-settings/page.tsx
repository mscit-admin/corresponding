'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertTriangle, IconClock, IconDeviceLaptop, IconDeviceFloppy } from '@tabler/icons-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { accessApi, type AccessConfig } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const DAYS = [
  { n: 0, label: 'الأحد' },
  { n: 1, label: 'الإثنين' },
  { n: 2, label: 'الثلاثاء' },
  { n: 3, label: 'الأربعاء' },
  { n: 4, label: 'الخميس' },
  { n: 5, label: 'الجمعة' },
  { n: 6, label: 'السبت' },
];

export default function AccessSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const allowed = user?.roleName === 'super_admin';

  const [cfg, setCfg] = useState<AccessConfig | null>(null);
  const [cidrText, setCidrText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    accessApi
      .getSettings()
      .then((c) => {
        setCfg(c);
        setCidrText((c.companyCidrs || []).join('\n'));
      })
      .catch(() => toast.error('تعذّر تحميل الإعدادات'))
      .finally(() => setLoading(false));
  }, [allowed]);

  const toggleDay = (n: number) => {
    if (!cfg) return;
    const days = cfg.days.includes(n) ? cfg.days.filter((d) => d !== n) : [...cfg.days, n];
    setCfg({ ...cfg, days });
  };

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const companyCidrs = cidrText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const updated = await accessApi.updateSettings({ ...cfg, companyCidrs });
      setCfg(updated);
      setCidrText((updated.companyCidrs || []).join('\n'));
      toast.success('تم حفظ الإعدادات');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
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
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <IconClock className="w-6 h-6 text-brand-600" />
          <h1 className="text-lg font-semibold text-slate-900">وقت الدوام والوصول</h1>
        </div>

        {loading || !cfg ? (
          <div className="card text-center py-10 text-sm text-slate-500">جارٍ التحميل...</div>
        ) : (
          <>
            <div className="card space-y-4">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <div className="font-medium text-slate-900">تفعيل تقييد وقت الدوام</div>
                  <div className="text-xs text-slate-500">يُطبَّق على الأجهزة خارج الشركة فقط. أجهزة الشركة مسموحة دائماً.</div>
                </div>
                <input
                  type="checkbox"
                  checked={cfg.enabled}
                  onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
                  className="w-5 h-5 accent-brand-600"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">بداية الدوام</label>
                  <input type="time" value={cfg.start} onChange={(e) => setCfg({ ...cfg, start: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">نهاية الدوام</label>
                  <input type="time" value={cfg.end} onChange={(e) => setCfg({ ...cfg, end: e.target.value })} className="input" />
                </div>
              </div>

              <div>
                <label className="label">أيام الدوام</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DAYS.map((d) => (
                    <button
                      key={d.n}
                      type="button"
                      onClick={() => toggleDay(d.n)}
                      className={`px-3 py-1.5 rounded-md text-sm ${cfg.days.includes(d.n) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">المنطقة الزمنية</label>
                <input
                  type="text"
                  value={cfg.timezone}
                  onChange={(e) => setCfg({ ...cfg, timezone: e.target.value })}
                  className="input font-mono"
                  placeholder="Asia/Riyadh"
                />
              </div>
            </div>

            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <IconDeviceLaptop className="w-5 h-5 text-brand-600" />
                <h2 className="font-medium text-slate-900">شبكة الشركة (الأجهزة الداخلية)</h2>
              </div>
              <p className="text-xs text-slate-500">
                نطاقات IP لشبكة المصلحة (CIDR، نطاق في كل سطر). الأجهزة ضمنها تُعدّ «داخل الشركة» ومسموحة دائماً.
                أي جهاز خارجها يخضع لوقت الدوام ويُرسَل إشعار لمدير النظام.
              </p>
              <textarea
                value={cidrText}
                onChange={(e) => setCidrText(e.target.value)}
                rows={4}
                className="input font-mono text-sm"
                placeholder={'192.168.0.0/16\n10.0.0.0/8'}
              />

              <label className="flex items-center justify-between gap-3 cursor-pointer pt-1">
                <div className="text-sm text-slate-700">إشعار مدير النظام عند كل دخول من جهاز خارجي</div>
                <input
                  type="checkbox"
                  checked={cfg.notifyExternal}
                  onChange={(e) => setCfg({ ...cfg, notifyExternal: e.target.checked })}
                  className="w-5 h-5 accent-brand-600"
                />
              </label>
            </div>

            <div className="card space-y-2">
              <h2 className="font-medium text-slate-900">طريقة التحقّق عند اعتماد المعاملات</h2>
              <p className="text-xs text-slate-500">الوسيلة المطلوبة لتأكيد هوية المُعتمِد قبل اعتماد أي معاملة.</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { v: 'email', label: 'رمز على البريد' },
                  { v: 'face', label: 'بصمة الوجه' },
                  { v: 'both', label: 'كلاهما (يختار الموظف)' },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setCfg({ ...cfg, approvalVerifyMethod: o.v })}
                    className={`px-3 py-1.5 rounded-md text-sm ${cfg.approvalVerifyMethod === o.v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={save} disabled={saving} className="btn-primary w-full">
              <IconDeviceFloppy className="w-4 h-4" />
              {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
