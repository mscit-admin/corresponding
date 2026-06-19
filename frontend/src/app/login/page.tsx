'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { IconArchive, IconUser, IconLock, IconLogin, IconAlertCircle, IconDeviceDesktop, IconClock, IconCircleCheck, IconWorld, IconMail } from '@tabler/icons-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

type LoginForm = z.infer<typeof loginSchema>;

// مراحل الشاشة: دخول عادي / اعتماد جهاز / بانتظار / دخول خارجي (نموذج) / بانتظار خارجي
type Stage = 'login' | 'request' | 'pending' | 'external' | 'external-pending';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('login');
  // نحتفظ ببيانات الدخول لإعادة استخدامها عند إرسال طلب الاعتماد
  const [creds, setCreds] = useState<{ username: string; password: string; fullName?: string }>({ username: '', password: '' });
  const [reason, setReason] = useState('');
  const [pendingMsg, setPendingMsg] = useState('');
  // نموذج الدخول الخارجي
  const [extName, setExtName] = useState('');
  const [extCode, setExtCode] = useState('');
  const [extSent, setExtSent] = useState<string | null>(null);
  const [extCooldown, setExtCooldown] = useState(0);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: 'admin', password: 'Admin@1234' },
  });

  // رسالة القفل التلقائي عند انتهاء تصريح الدخول الخارجي
  useEffect(() => {
    try {
      const reason = sessionStorage.getItem('gsdms-lock-reason');
      if (reason === 'EXTERNAL_GRANT_EXPIRED') {
        sessionStorage.removeItem('gsdms-lock-reason');
        setError('انتهت صلاحية تصريح الدخول الخارجي وتم إنهاء جلستك. يمكنك تقديم طلب جديد أو الدخول من جهاز داخل المؤسسة.');
      } else if (reason === 'EXTERNAL_LOCKED') {
        sessionStorage.removeItem('gsdms-lock-reason');
        setError('تم إيقاف الدخول الخارجي لحسابك من قِبل مدير النظام.');
      }
    } catch { /* ignore */ }
  }, []);

  // مؤقّت إعادة إرسال رمز الدخول الخارجي
  useEffect(() => {
    if (extCooldown <= 0) return;
    const t = setTimeout(() => setExtCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [extCooldown]);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(data.username, data.password);
      setAuth(response.accessToken, response.user);
      toast.success(`مرحباً بك ${response.user.fullName}`);
      router.push('/dashboard');
    } catch (err: any) {
      const code = err.response?.data?.code as string | undefined;
      const message = err.response?.data?.message || 'حدث خطأ في تسجيل الدخول';
      if (code === 'DEVICE_APPROVAL_REQUIRED') {
        // جهاز جديد — انتقل لشاشة إدخال سبب الدخول
        setCreds({ username: data.username, password: data.password, fullName: err.response?.data?.fullName });
        setReason('');
        setStage('request');
      } else if (code === 'DEVICE_PENDING') {
        setPendingMsg(message);
        setStage('pending');
      } else if (code === 'EXTERNAL_APPROVAL_REQUIRED') {
        // دخول خارجي — نموذج الاسم الثلاثي + رمز البريد
        setCreds({ username: data.username, password: data.password, fullName: err.response?.data?.fullName });
        setExtName('');
        setExtCode('');
        setExtSent(null);
        setStage('external');
      } else if (code === 'EXTERNAL_PENDING') {
        setPendingMsg(message);
        setStage('external-pending');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitRequest = async () => {
    if (reason.trim().length < 5) {
      setError('يرجى إدخال سبب واضح (5 أحرف على الأقل).');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.requestDeviceApproval(creds.username, creds.password, reason.trim());
      setPendingMsg(res.message);
      setStage('pending');
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذّر إرسال الطلب');
    } finally {
      setIsLoading(false);
    }
  };

  const sendExtCode = async () => {
    setError(null);
    try {
      const res = await authApi.requestExternalCode(creds.username, creds.password);
      setExtSent(res.sentTo);
      setExtCooldown(30);
      toast.success(res.delivered ? `تم إرسال الرمز إلى ${res.sentTo}` : 'تم توليد الرمز (راجع سجلّ الخادم في وضع التطوير)');
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذّر إرسال الرمز');
    }
  };

  const submitExternal = async () => {
    if (extName.trim().length < 3) {
      setError('يرجى إدخال الاسم الثلاثي كما هو مسجّل.');
      return;
    }
    if (extCode.trim().length < 4) {
      setError('يرجى إدخال رمز التحقّق المُرسَل على بريدك.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.submitExternalRequest(creds.username, creds.password, extName.trim(), extCode.trim());
      setPendingMsg(res.message);
      setStage('external-pending');
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذّر إرسال الطلب');
    } finally {
      setIsLoading(false);
    }
  };

  const backToLogin = () => {
    setStage('login');
    setError(null);
    setReason('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 via-white to-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4">
            <IconArchive className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">نظام الأرشفة الإلكترونية</h1>
          <p className="text-sm text-slate-500 mt-1">وزارة الشؤون الإدارية</p>
        </div>

        <div className="card shadow-sm">
          {stage === 'login' && (
            <>
              <h2 className="text-lg font-medium text-slate-900 mb-4">تسجيل الدخول</h2>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">اسم المستخدم</label>
                  <div className="relative">
                    <IconUser className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" autoComplete="username" className="input pr-10" placeholder="admin" {...register('username')} />
                  </div>
                  {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>}
                </div>

                <div>
                  <label className="label">كلمة المرور</label>
                  <div className="relative">
                    <IconLock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="password" autoComplete="current-password" className="input pr-10" placeholder="••••••••" {...register('password')} />
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    <IconAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="btn-primary w-full">
                  <IconLogin className="w-4 h-4" />
                  {isLoading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500 text-center">
                <p>بيانات تجريبية: <span className="font-mono text-slate-700">admin</span> / <span className="font-mono text-slate-700">Admin@1234</span></p>
              </div>
            </>
          )}

          {stage === 'request' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <IconDeviceDesktop className="w-6 h-6" />
                <h2 className="text-lg font-medium text-slate-900">جهاز جديد يحتاج موافقة</h2>
              </div>
              <p className="text-sm text-slate-600">
                {creds.fullName ? <span className="font-medium">{creds.fullName} — </span> : null}
                تم اكتشاف دخولك من جهاز/متصفّح جديد. يرجى توضيح سبب الدخول ليُرسَل إلى مدير النظام للموافقة.
              </p>

              <div>
                <label className="label">سبب الدخول من جهاز جديد</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="مثال: تغيّر مكان العمل / جهاز جديد / العمل من المنزل..."
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  <IconAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button onClick={submitRequest} disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'جارٍ الإرسال...' : 'إرسال الطلب لمدير النظام'}
              </button>
              <button onClick={backToLogin} className="btn w-full text-sm">رجوع</button>
            </div>
          )}

          {stage === 'pending' && (
            <div className="space-y-4 text-center py-4">
              <IconClock className="w-12 h-12 text-amber-500 mx-auto" />
              <h2 className="text-lg font-medium text-slate-900">بانتظار موافقة مدير النظام</h2>
              <p className="text-sm text-slate-600">{pendingMsg || 'تم إرسال طلبك. سيتم إشعارك عند الموافقة على الجهاز.'}</p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <IconCircleCheck className="w-4 h-4" />
                <span>بعد الموافقة، يمكنك تسجيل الدخول من هذا الجهاز مباشرة.</span>
              </div>
              <button onClick={backToLogin} className="btn w-full text-sm">العودة لتسجيل الدخول</button>
            </div>
          )}

          {stage === 'external' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-brand-600">
                <IconWorld className="w-6 h-6" />
                <h2 className="text-lg font-medium text-slate-900">دخول من خارج شبكة المؤسسة</h2>
              </div>
              <p className="text-sm text-slate-600">
                الدخول من خارج الشبكة يتطلّب موافقة مدير النظام. أكمل بياناتك ثم أرسل الطلب.
              </p>

              <div>
                <label className="label">الاسم الثلاثي (كما هو مسجّل)</label>
                <input value={extName} onChange={(e) => setExtName(e.target.value)} className="input" placeholder="الاسم الأول الأوسط الأخير" />
              </div>

              <div>
                <label className="label">رمز التحقّق على البريد</label>
                <div className="flex gap-2">
                  <input
                    value={extCode}
                    onChange={(e) => setExtCode(e.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                    maxLength={6}
                    className="input text-center tracking-[0.4em] font-mono"
                    placeholder="------"
                  />
                  <button
                    type="button"
                    onClick={sendExtCode}
                    disabled={extCooldown > 0}
                    className="btn text-xs whitespace-nowrap disabled:opacity-50"
                  >
                    <IconMail className="w-4 h-4" />
                    {extCooldown > 0 ? `${extCooldown}ث` : extSent ? 'إعادة الإرسال' : 'إرسال الرمز'}
                  </button>
                </div>
                {extSent && <p className="mt-1 text-xs text-emerald-600">أُرسل الرمز إلى {extSent}</p>}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  <IconAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button onClick={submitExternal} disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'جارٍ الإرسال...' : 'إرسال الطلب لمدير النظام'}
              </button>
              <button onClick={backToLogin} className="btn w-full text-sm">رجوع</button>
            </div>
          )}

          {stage === 'external-pending' && (
            <div className="space-y-4 text-center py-4">
              <IconClock className="w-12 h-12 text-amber-500 mx-auto" />
              <h2 className="text-lg font-medium text-slate-900">بانتظار موافقة مدير النظام</h2>
              <p className="text-sm text-slate-600">{pendingMsg || 'تم إرسال طلب الدخول الخارجي. سيتم إشعارك عند الموافقة.'}</p>
              <button onClick={backToLogin} className="btn w-full text-sm">العودة لتسجيل الدخول</button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">© 2026 نظام الأرشفة الإلكترونية الذكي - GSDMS</p>
      </div>
    </div>
  );
}
