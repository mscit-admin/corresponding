'use client';

import {
  IconArrowDown, IconCheck, IconRoute, IconCircleCheck, IconCircleX,
  IconArrowBackUp, IconNote, IconPrinter, IconLock, IconArchive, IconEye, IconClock,
} from '@tabler/icons-react';
import { actionLabel } from '@/lib/incoming-constants';
import { formatDateTimeAr, cn } from '@/lib/utils';
import type { IncomingCorrespondence, IncomingActionKind } from '@/types';

const ICON: Record<IncomingActionKind, React.ReactNode> = {
  open: <IconEye className="w-3 h-3" />,
  refer: <IconRoute className="w-3 h-3" />,
  approve: <IconCircleCheck className="w-3 h-3" />,
  reject: <IconCircleX className="w-3 h-3" />,
  return: <IconArrowBackUp className="w-3 h-3" />,
  note: <IconNote className="w-3 h-3" />,
  print: <IconPrinter className="w-3 h-3" />,
  close: <IconLock className="w-3 h-3" />,
  archive: <IconArchive className="w-3 h-3" />,
};

const COLOR: Record<IncomingActionKind, string> = {
  open: 'bg-slate-100 text-slate-600',
  refer: 'bg-sky-100 text-sky-700',
  approve: 'bg-emerald-100 text-emerald-700',
  reject: 'bg-red-100 text-red-700',
  return: 'bg-orange-100 text-orange-700',
  note: 'bg-slate-100 text-slate-600',
  print: 'bg-slate-100 text-slate-600',
  close: 'bg-slate-200 text-slate-700',
  archive: 'bg-slate-100 text-slate-500',
};

/** سجل حركة المعاملة (Timeline) — أحداث أساسية + كل الإجراءات الموثّقة. */
export function IncomingTimeline({ data }: { data: IncomingCorrespondence }) {
  const actions = data.actions ?? [];

  return (
    <div className="card">
      <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
        <IconClock className="w-4 h-4 text-slate-400" /> سجل حركة المعاملة
        {actions.length ? <span className="text-slate-400 font-normal">({actions.length + 2})</span> : null}
      </h2>

      <Step
        icon={<IconArrowDown className="w-3 h-3" />}
        color="bg-emerald-100 text-emerald-700"
        title="وردت من الجهة المرسلة"
        subtitle={data.senderEntity?.nameAr}
        date={data.receivedAt}
      />
      <Step
        icon={<IconCheck className="w-3 h-3" />}
        color="bg-emerald-100 text-emerald-700"
        title="تم التسجيل في النظام"
        subtitle={data.creator ? `بواسطة: ${data.creator.fullName}` : undefined}
        date={data.createdAt}
        isLast={actions.length === 0}
      />

      {actions.map((a, i) => (
        <Step
          key={a.id}
          icon={ICON[a.action] ?? <IconClock className="w-3 h-3" />}
          color={COLOR[a.action] ?? 'bg-slate-100 text-slate-600'}
          title={actionLabel(a.action)}
          subtitle={
            [a.actorName ? `بواسطة: ${a.actorName}` : null, a.actorDepartment]
              .filter(Boolean)
              .join(' — ') || undefined
          }
          note={a.note}
          date={a.createdAt}
          isLast={i === actions.length - 1}
        />
      ))}
    </div>
  );
}

function Step({
  icon, color, title, subtitle, note, date, isLast,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle?: string | null;
  note?: string | null;
  date: string | null;
  isLast?: boolean;
}) {
  return (
    <div className="flex gap-3 mb-3 last:mb-0">
      <div className="flex flex-col items-center shrink-0">
        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', color)}>{icon}</div>
        {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[20px]" />}
      </div>
      <div className="flex-1 pb-2">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        {subtitle && <div className="text-xs text-slate-600 mt-0.5">{subtitle}</div>}
        {note && (
          <div className="text-xs text-slate-700 mt-1 bg-slate-50 border border-slate-100 rounded p-2 leading-relaxed">
            {note}
          </div>
        )}
        {date && <div className="text-xs text-slate-400 mt-0.5">{formatDateTimeAr(date)}</div>}
      </div>
    </div>
  );
}
