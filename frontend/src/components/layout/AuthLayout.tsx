'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  IconArchive, IconSearch, IconBell, IconHome, IconInbox,
  IconFileText, IconSend, IconChartBar, IconUsers, IconSettings, IconLogout,
} from '@tabler/icons-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'الرئيسية', icon: IconHome },
  { href: '/inbox', label: 'صندوق الوارد', icon: IconInbox, badge: '24' },
  { href: '/outgoing', label: 'الصادر', icon: IconSend, disabled: true },
  { href: '/archive', label: 'الأرشيف', icon: IconFileText, disabled: true },
  { href: '/reports', label: 'التقارير', icon: IconChartBar, disabled: true },
  { href: '/users', label: 'المستخدمين', icon: IconUsers, disabled: true },
  { href: '/settings', label: 'الإعدادات', icon: IconSettings, disabled: true },
];

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, logout } = useAuthStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!token) router.push('/login');
  }, [token, router]);

  if (!token || !user) return null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
              <IconArchive className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">نظام الأرشفة الإلكترونية</div>
              <div className="text-[10px] text-slate-500">وزارة الشؤون الإدارية</div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/inbox?q=${encodeURIComponent(search.trim())}`);
            }}
            className="flex-1 max-w-md relative hidden md:block"
          >
            <IconSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pr-10"
              placeholder="ابحث برقم المراسلة، الموضوع، أو الجهة..."
            />
          </form>

          <div className="flex items-center gap-3 shrink-0">
            <button className="relative p-2 rounded-md hover:bg-slate-100" aria-label="إشعارات">
              <IconBell className="w-5 h-5 text-slate-600" />
              <span className="absolute -top-0.5 -left-0.5 bg-red-500 text-white text-[9px] px-1.5 rounded-full font-medium">5</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                {user.fullName.slice(0, 2)}
              </div>
              <div className="hidden md:block">
                <div className="text-xs font-medium text-slate-900">{user.fullName}</div>
                <div className="text-[10px] text-slate-500">{user.role}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-md hover:bg-red-50 text-red-600" title="تسجيل الخروج">
              <IconLogout className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <aside className="w-56 bg-white border-l border-slate-200 hidden md:block">
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return item.disabled ? (
                <div key={item.href} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-400 cursor-not-allowed">
                  <Icon className="w-4 h-4" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">قريباً</span>
                </div>
              ) : (
                <Link key={item.href} href={item.href}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-slate-50',
                  )}>
                  <Icon className="w-4 h-4" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700')}>{item.badge}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 mt-4 border-t border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase mb-2 font-semibold">الإدارة</div>
            <div className="text-xs text-slate-600">{user.department}</div>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
