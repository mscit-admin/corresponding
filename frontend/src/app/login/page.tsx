'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { IconArchive, IconUser, IconLock, IconLogin, IconAlertCircle } from '@tabler/icons-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: 'admin', password: 'Admin@1234' },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(data.username, data.password);
      setAuth(response.accessToken, response.user);
      toast.success(`مرحباً بك ${response.user.fullName}`);
      router.push('/dashboard');
    } catch (err: any) {
      const message = err.response?.data?.message || 'حدث خطأ في تسجيل الدخول';
      setError(message);
    } finally {
      setIsLoading(false);
    }
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
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">© 2026 نظام الأرشفة الإلكترونية الذكي - GSDMS</p>
      </div>
    </div>
  );
}
