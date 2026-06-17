'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconX, IconSettings, IconPencil, IconTrash, IconCheck } from '@tabler/icons-react';
import { toast } from 'sonner';
import { transactionTypesApi } from '@/lib/api';
import type { TransactionType } from '@/types';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** هل يملك المستخدم صلاحية إضافة/تعديل/حذف الأنواع */
  canManage?: boolean;
}

/**
 * قائمة أنواع المعاملة مع إمكانية إدارة كاملة (إضافة، تعديل التسمية، حذف)
 * لأصحاب الصلاحية. القيمة المخزّنة هي اسم النوع (نص).
 */
export function TransactionTypeSelect({ value, onChange, canManage }: Props) {
  const qc = useQueryClient();
  const [managing, setManaging] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['transaction-types'],
    queryFn: transactionTypesApi.list,
  });

  return (
    <div className="space-y-1.5">
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      >
        <option value="">{isLoading ? 'جارٍ التحميل...' : '-- اختر --'}</option>
        {data?.map((t) => (
          <option key={t.id} value={t.name}>{t.name}</option>
        ))}
        {/* أبقِ القيمة الحالية ظاهرة حتى لو كانت من نوع محذوف (سجل قديم) */}
        {value && !data?.some((t) => t.name === value) && (
          <option value={value}>{value}</option>
        )}
      </select>

      {canManage && (
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
        >
          <IconSettings className="w-3.5 h-3.5" /> إدارة أنواع المعاملات
        </button>
      )}

      {managing && (
        <ManageTypesModal
          types={data || []}
          onClose={() => setManaging(false)}
          onDeleted={(name) => { if (name === value) onChange(''); }}
          onRenamed={(oldName, newName) => { if (oldName === value) onChange(newName); }}
          qc={qc}
        />
      )}
    </div>
  );
}

function ManageTypesModal({
  types, onClose, onDeleted, onRenamed, qc,
}: {
  types: TransactionType[];
  onClose: () => void;
  onDeleted: (name: string) => void;
  onRenamed: (oldName: string, newName: string) => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['transaction-types'] });

  const createMut = useMutation({
    mutationFn: (name: string) => transactionTypesApi.create(name),
    onSuccess: () => { invalidate(); setNewName(''); toast.success('تمت الإضافة'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'تعذّرت الإضافة'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => transactionTypesApi.update(id, name),
    onSuccess: (_res, vars) => {
      const old = types.find((t) => t.id === vars.id)?.name || '';
      onRenamed(old, vars.name);
      invalidate();
      setEditingId(null);
      toast.success('تم تعديل التسمية');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'تعذّر التعديل'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => transactionTypesApi.remove(id),
    onSuccess: (_res, id) => {
      const removed = types.find((t) => t.id === id)?.name || '';
      onDeleted(removed);
      invalidate();
      toast.success('تم الحذف');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'تعذّر الحذف'),
  });

  const addNew = () => {
    const name = newName.trim();
    if (name) createMut.mutate(name);
  };
  const saveEdit = () => {
    const name = editName.trim();
    if (name && editingId) updateMut.mutate({ id: editingId, name });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <IconSettings className="w-4 h-4 text-slate-400" /> إدارة أنواع المعاملات
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="إغلاق">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* إضافة نوع جديد */}
        <div className="px-4 py-3 border-b border-slate-200 flex gap-1.5">
          <input
            className="input flex-1"
            placeholder="اسم النوع الجديد..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }}
          />
          <button type="button" className="btn-primary text-xs whitespace-nowrap" disabled={!newName.trim() || createMut.isPending} onClick={addNew}>
            <IconPlus className="w-3.5 h-3.5" /> إضافة
          </button>
        </div>

        {/* قائمة الأنواع */}
        <div className="overflow-y-auto p-2 flex-1">
          {types.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">لا توجد أنواع بعد</p>
          ) : (
            <ul className="space-y-1">
              {types.map((t) => (
                <li key={t.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-slate-50">
                  {editingId === t.id ? (
                    <>
                      <input
                        autoFocus
                        className="input flex-1 py-1"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } }}
                      />
                      <button type="button" className="btn-primary text-xs py-1" disabled={!editName.trim() || updateMut.isPending} onClick={saveEdit} aria-label="حفظ">
                        <IconCheck className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" className="btn text-xs py-1" onClick={() => setEditingId(null)} aria-label="إلغاء">
                        <IconX className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{t.name}</span>
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-brand-600"
                        onClick={() => { setEditingId(t.id); setEditName(t.name); }}
                        aria-label="تعديل"
                      >
                        <IconPencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-red-600"
                        disabled={deleteMut.isPending}
                        onClick={() => { if (confirm(`حذف نوع المعاملة "${t.name}"؟`)) deleteMut.mutate(t.id); }}
                        aria-label="حذف"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
          <button type="button" className="btn text-sm" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}
