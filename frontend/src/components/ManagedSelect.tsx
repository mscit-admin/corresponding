'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';

interface ManagedSelectProps<T> {
  value: string;
  onChange: (value: string) => void;
  queryKey: string[];
  fetcher: () => Promise<T[]>;
  creator?: (name: string) => Promise<T>;
  getValue: (item: T) => string;
  getLabel: (item: T) => string;
  placeholder?: string;
  canCreate?: boolean;
  createLabel?: string;
}

/**
 * قائمة منسدلة تجلب خياراتها من قاعدة البيانات، مع إمكانية إضافة خيار جديد
 * فورياً (لأصحاب الصلاحية).
 */
export function ManagedSelect<T>({
  value, onChange, queryKey, fetcher, creator, getValue, getLabel,
  placeholder = '-- اختر --', canCreate, createLabel = 'إضافة جديد',
}: ManagedSelectProps<T>) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const { data, isLoading } = useQuery({ queryKey, queryFn: fetcher });

  const createMut = useMutation({
    mutationFn: (name: string) => creator!(name),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey });
      onChange(getValue(created));
      setAdding(false);
      setNewName('');
      toast.success('تمت الإضافة بنجاح');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'تعذّرت الإضافة'),
  });

  const submitNew = () => {
    const name = newName.trim();
    if (name) createMut.mutate(name);
  };

  return (
    <div className="space-y-1.5">
      {!adding ? (
        <select
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
        >
          <option value="">{isLoading ? 'جارٍ التحميل...' : placeholder}</option>
          {data?.map((item) => (
            <option key={getValue(item)} value={getValue(item)}>{getLabel(item)}</option>
          ))}
        </select>
      ) : (
        <div className="flex gap-1.5">
          <input
            autoFocus
            className="input flex-1"
            placeholder="اكتب الاسم..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitNew(); } }}
          />
          <button type="button" className="btn-primary text-xs whitespace-nowrap" disabled={!newName.trim() || createMut.isPending} onClick={submitNew}>
            {createMut.isPending ? '...' : 'حفظ'}
          </button>
          <button type="button" className="btn text-xs" onClick={() => { setAdding(false); setNewName(''); }} aria-label="إلغاء">
            <IconX className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {canCreate && creator && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
        >
          <IconPlus className="w-3.5 h-3.5" /> {createLabel}
        </button>
      )}
    </div>
  );
}
