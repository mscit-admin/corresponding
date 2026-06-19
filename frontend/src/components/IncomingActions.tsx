'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  IconCircleCheck, IconCircleX, IconArrowBackUp, IconNote,
  IconPrinter, IconLock, IconArchive,
} from '@tabler/icons-react';
import { incomingApi, otpApi, type ApprovalVerifyMethod } from '@/lib/api';
import { canDecide } from '@/lib/permissions';
import { FaceCapture } from '@/components/FaceCapture';
import { OtpVerify } from '@/components/OtpVerify';
import type { IncomingCorrespondence } from '@/types';

const NEEDS_NOTE = ['reject', 'return', 'note'];
const TERMINAL = ['closed', 'archived'];

/** شريط إجراءات إدارة المعاملة (اعتماد/رفض/إعادة/ملاحظة/طباعة/إغلاق/أرشفة). */
export function IncomingActions({
  data,
  roleName,
  onPrintSerial,
}: {
  data: IncomingCorrespondence;
  roleName?: string;
  onPrintSerial: () => void;
}) {
  const qc = useQueryClient();
  const id = data.id;
  const decide = canDecide(roleName);
  const isArchived = data.status === 'archived';
  const isTerminal = TERMINAL.includes(data.status);

  const [modal, setModal] = useState<null | { action: string; title: string; required: boolean }>(null);
  const [note, setNote] = useState('');
  // مراحل تحقّق الاعتماد: اختيار الطريقة / الوجه / رمز البريد — مع حفظ الملاحظة
  const [verify, setVerify] = useState<null | { note?: string; stage: 'choose' | 'face' | 'otp' }>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['incoming', id] });
    qc.invalidateQueries({ queryKey: ['incoming'] });
  };

  const mut = useMutation({
    mutationFn: (vars: { action: string; note?: string; verify?: { faceDescriptor?: number[]; otpCode?: string } }) =>
      incomingApi.act(id, vars.action, vars.note, vars.verify),
    onSuccess: () => {
      toast.success('تم تنفيذ الإجراء');
      refresh();
      setModal(null);
      setNote('');
      setVerify(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'تعذّر تنفيذ الإجراء'),
  });

  const openModal = (action: string, title: string) =>
    setModal({ action, title, required: NEEDS_NOTE.includes(action) });

  const startApprovalVerify = async (noteVal?: string) => {
    try {
      const method: ApprovalVerifyMethod = await otpApi.method();
      setModal(null);
      if (method === 'face') setVerify({ note: noteVal, stage: 'face' });
      else if (method === 'email') setVerify({ note: noteVal, stage: 'otp' });
      else setVerify({ note: noteVal, stage: 'choose' });
    } catch {
      toast.error('تعذّر تحديد طريقة التحقّق');
    }
  };

  const submit = () => {
    if (modal?.required && !note.trim()) {
      toast.error('يجب إدخال ملاحظة/سبب لهذا الإجراء');
      return;
    }
    // الاعتماد (التوقيع) يتطلّب تحقّقاً إضافياً قبل التنفيذ
    if (modal!.action === 'approve') {
      void startApprovalVerify(note.trim() || undefined);
      return;
    }
    mut.mutate({ action: modal!.action, note: note.trim() || undefined });
  };

  const onFaceCaptured = (descriptor: number[]) => {
    const noteVal = verify?.note;
    setVerify(null);
    mut.mutate({ action: 'approve', note: noteVal, verify: { faceDescriptor: descriptor } });
  };

  const onOtpEntered = (otpCode: string) => {
    const noteVal = verify?.note;
    setVerify(null);
    mut.mutate({ action: 'approve', note: noteVal, verify: { otpCode } });
  };

  const handlePrint = async () => {
    onPrintSerial();
    try {
      await incomingApi.act(id, 'print');
      refresh();
    } catch {
      /* الطباعة تمت؛ تسجيلها فقط فشل */
    }
  };

  return (
    <div className="card">
      <h2 className="text-sm font-medium mb-3">إجراءات المعاملة</h2>
      <div className="flex flex-wrap gap-2">
        {/* متاح للجميع */}
        <button onClick={() => openModal('note', 'إضافة ملاحظة')} className="btn">
          <IconNote className="w-4 h-4" /> إضافة ملاحظة
        </button>
        <button onClick={handlePrint} className="btn">
          <IconPrinter className="w-4 h-4" /> طباعة
        </button>
        <button
          onClick={() => openModal('return', 'إعادة المعاملة')}
          disabled={isTerminal}
          className="btn disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <IconArrowBackUp className="w-4 h-4" /> إعادة
        </button>

        {/* للمدراء فقط */}
        {decide && (
          <>
            <button
              onClick={() => openModal('approve', 'اعتماد المعاملة')}
              disabled={isTerminal}
              className="btn text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconCircleCheck className="w-4 h-4" /> اعتماد
            </button>
            <button
              onClick={() => openModal('reject', 'رفض المعاملة')}
              disabled={isTerminal}
              className="btn text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconCircleX className="w-4 h-4" /> رفض
            </button>
            <button
              onClick={() => openModal('close', 'إغلاق المعاملة')}
              disabled={isTerminal}
              className="btn disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconLock className="w-4 h-4" /> إغلاق
            </button>
            <button
              onClick={() => openModal('archive', 'أرشفة المعاملة')}
              disabled={isArchived}
              className="btn disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconArchive className="w-4 h-4" /> أرشفة
            </button>
          </>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900">{modal.title}</h3>
            {modal.action === 'approve' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                يتطلّب الاعتماد تحقّقاً إضافياً من هويتك. بعد التأكيد ستظهر خطوة التحقّق (رمز البريد أو بصمة الوجه).
              </p>
            )}
            <textarea
              autoFocus
              className="input"
              rows={4}
              placeholder={modal.required ? 'اكتب الملاحظة / السبب (إلزامي)…' : 'ملاحظة (اختياري)…'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="btn text-xs">إلغاء</button>
              <button
                onClick={submit}
                disabled={mut.isPending}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {mut.isPending ? 'جارٍ التنفيذ…' : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {verify?.stage === 'choose' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setVerify(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900">اختر طريقة التحقّق للاعتماد</h3>
            <button onClick={() => setVerify({ ...verify, stage: 'otp' })} className="btn-primary w-full text-sm">
              رمز على البريد الإلكتروني
            </button>
            <button onClick={() => setVerify({ ...verify, stage: 'face' })} className="btn w-full text-sm">
              بصمة الوجه (الكاميرا)
            </button>
            <button onClick={() => setVerify(null)} className="btn w-full text-xs">إلغاء</button>
          </div>
        </div>
      )}

      {verify?.stage === 'face' && (
        <FaceCapture mode="verify" onCapture={onFaceCaptured} onClose={() => setVerify(null)} />
      )}

      {verify?.stage === 'otp' && (
        <OtpVerify onVerified={onOtpEntered} onClose={() => setVerify(null)} />
      )}
    </div>
  );
}
