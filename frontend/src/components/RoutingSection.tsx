'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconRoute, IconBuildingCommunity, IconNote } from '@tabler/icons-react';
import { toast } from 'sonner';
import { incomingApi, referenceApi } from '@/lib/api';
import { formatDateTimeAr } from '@/lib/utils';
import type { IncomingRouting } from '@/types';

/** التوجيه/التهميش — manager directs the message to the concerned department(s). */
export function RoutingSection({ id, routings, canRoute }: { id: string; routings?: IncomingRouting[]; canRoute: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: referenceApi.departments, enabled: open });

  const mut = useMutation({
    mutationFn: () => incomingApi.route(id, { departmentIds: deptIds, note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success('تم توجيه الرسالة للإدارة المختصة');
      qc.invalidateQueries({ queryKey: ['incoming', id] });
      qc.invalidateQueries({ queryKey: ['incoming'] });
      setOpen(false); setDeptIds([]); setNote('');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'تعذّر التوجيه'),
  });

  const toggle = (d: string) => setDeptIds((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <IconRoute className="w-4 h-4 text-slate-400" /> التوجيه / التهميش
          {routings?.length ? <span className="text-slate-400 font-normal">({routings.length})</span> : null}
        </h2>
        {canRoute && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="btn-primary text-xs">
            <IconRoute className="w-3.5 h-3.5" /> توجيه
          </button>
        )}
      </div>

      {open && (
        <div className="border border-slate-200 rounded-md p-3 mb-3 space-y-2 bg-slate-50">
          <div className="text-xs text-slate-500">اختر الإدارة/الإدارات المختصة:</div>
          <div className="max-h-40 overflow-auto space-y-1 bg-white rounded border border-slate-200 p-2">
            {!departments?.length && <div className="text-xs text-slate-400">جارٍ التحميل...</div>}
            {departments?.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-1">
                <input type="checkbox" checked={deptIds.includes(d.id)} onChange={() => toggle(d.id)} />
                <span>{d.name}</span>
              </label>
            ))}
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder="التهميش / ملاحظة التوجيه (اختياري) — مثال: للاختصاص واتخاذ اللازم"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="btn text-xs">إلغاء</button>
            <button
              type="button"
              onClick={() => mut.mutate()}
              disabled={!deptIds.length || mut.isPending}
              className="btn-primary text-xs disabled:opacity-50"
            >
              {mut.isPending ? 'جارٍ التوجيه...' : 'تأكيد التوجيه'}
            </button>
          </div>
        </div>
      )}

      {!routings?.length ? (
        <p className="text-xs text-slate-400">لم تُوجَّه الرسالة بعد.</p>
      ) : (
        <div className="space-y-2">
          {routings.map((r) => (
            <div key={r.id} className="text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800 inline-flex items-center gap-1">
                  <IconBuildingCommunity className="w-3.5 h-3.5 text-brand-600" /> {r.departmentName || '—'}
                </span>
                <span className="text-slate-400">{formatDateTimeAr(r.createdAt)}</span>
              </div>
              {r.note && (
                <div className="text-slate-600 mt-1 inline-flex items-start gap-1">
                  <IconNote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" /> {r.note}
                </div>
              )}
              {r.routedBy && <div className="text-[10px] text-slate-400 mt-0.5">بواسطة: {r.routedBy}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
