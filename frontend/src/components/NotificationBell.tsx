'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconBell } from '@tabler/icons-react';
import { notificationsApi } from '@/lib/api';
import { timeAgoAr, cn } from '@/lib/utils';
import type { AppNotification } from '@/types';

export function NotificationBell() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: count = 0 } = useQuery({
    queryKey: ['notif-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30000,
  });

  const { data: items } = useQuery({
    queryKey: ['notif-list'],
    queryFn: () => notificationsApi.list(),
    enabled: open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notif-count'] });
    qc.invalidateQueries({ queryKey: ['notif-list'] });
  };

  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: invalidate });

  const handleClick = async (n: AppNotification) => {
    if (!n.isRead) {
      try {
        await notificationsApi.markRead(n.id);
        invalidate();
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    if (n.actionUrl) router.push(n.actionUrl);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md hover:bg-slate-100"
        aria-label="إشعارات"
      >
        <IconBell className="w-5 h-5 text-slate-600" />
        {count > 0 && (
          <span className="absolute -top-0.5 -left-0.5 bg-red-500 text-white text-[9px] px-1.5 rounded-full font-medium">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-40 max-h-[28rem] overflow-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 sticky top-0 bg-white">
              <span className="text-sm font-semibold text-slate-800">التنبيهات</span>
              <button
                onClick={() => markAll.mutate()}
                className="text-[11px] text-brand-600 hover:underline"
              >
                تعليم الكل كمقروء
              </button>
            </div>
            {!items?.length ? (
              <div className="px-3 py-8 text-center text-xs text-slate-400">لا توجد تنبيهات</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-right px-3 py-2 border-b border-slate-50 hover:bg-slate-50 block',
                    !n.isRead && 'bg-blue-50/50',
                  )}
                >
                  <div className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />}
                    {n.title}
                  </div>
                  {n.body && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] text-slate-400 mt-0.5">{timeAgoAr(n.createdAt)}</div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
