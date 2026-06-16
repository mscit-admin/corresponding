'use client';

import { useQuery } from '@tanstack/react-query';
import { IconWorld, IconBuildingCommunity, IconLock } from '@tabler/icons-react';
import { referenceApi } from '@/lib/api';
import { VISIBILITY_OPTIONS } from '@/lib/incoming-constants';

const ICONS: Record<string, any> = {
  public: IconWorld,
  departments: IconBuildingCommunity,
  private: IconLock,
};

interface Props {
  visibility: string;
  onVisibilityChange: (v: string) => void;
  deptIds: string[];
  onDeptIdsChange: (ids: string[]) => void;
}

/** يحدّد مَن يستطيع مشاهدة الرسالة: الجميع / إدارات معيّنة / منع على الكل. */
export function VisibilitySelector({ visibility, onVisibilityChange, deptIds, onDeptIdsChange }: Props) {
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: referenceApi.departments });

  const toggle = (id: string) =>
    onDeptIdsChange(deptIds.includes(id) ? deptIds.filter((d) => d !== id) : [...deptIds, id]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {VISIBILITY_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.value] || IconWorld;
          const active = visibility === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onVisibilityChange(opt.value)}
              className={`text-right border rounded-md p-3 flex items-start gap-2 transition-colors ${
                active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-[10px] text-slate-500">{opt.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {visibility === 'departments' && (
        <div className="border border-slate-200 rounded-md p-3 space-y-1.5 max-h-56 overflow-auto">
          <div className="text-xs text-slate-500 mb-1">اختر الإدارات المسموح لها بالمشاهدة:</div>
          {!departments?.length && <div className="text-xs text-slate-400">لا توجد إدارات.</div>}
          {departments?.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
              <input type="checkbox" checked={deptIds.includes(d.id)} onChange={() => toggle(d.id)} />
              <span>{d.name}</span>
            </label>
          ))}
          {visibility === 'departments' && deptIds.length === 0 && (
            <p className="text-[11px] text-red-600">اختر إدارة واحدة على الأقل.</p>
          )}
        </div>
      )}
    </div>
  );
}
