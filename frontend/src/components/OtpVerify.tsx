'use client';

import { useEffect, useState } from 'react';
import { IconMail, IconX, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import { otpApi } from '@/lib/api';

/**
 * نافذة إدخال رمز التحقّق المُرسَل على البريد. تطلب الرمز تلقائياً عند الفتح،
 * وتستدعي onVerified بالرمز عند الإدخال (التحقّق الفعلي يتم في الخادم عند الاعتماد).
 */
export function OtpVerify({
  onVerified,
  onClose,
}: {
  onVerified: (code: string) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(true);
  const [cooldown, setCooldown] = useState(0);

  const request = async () => {
    setSending(true);
    try {
      const res = await otpApi.requestApprovalCode();
      setSentTo(res.sentTo);
      setCooldown(30);
      toast.success(res.delivered ? `تم إرسال الرمز إلى ${res.sentTo}` : 'تم توليد الرمز (راجع سجلّ الخادم في وضع التطوير)');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'تعذّر إرسال رمز التحقّق');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    void request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = () => {
    if (code.trim().length < 4) {
      toast.error('أدخل رمز التحقّق');
      return;
    }
    onVerified(code.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <IconMail className="w-5 h-5 text-brand-600" /> التحقّق برمز البريد
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><IconX className="w-4 h-4" /></button>
        </div>

        <p className="text-sm text-slate-600">
          {sending ? 'جارٍ إرسال رمز التحقّق…' : sentTo ? `أُرسل رمز مكوّن من 6 أرقام إلى ${sentTo}. أدخله للاعتماد.` : 'تعذّر الإرسال.'}
        </p>

        <input
          autoFocus
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="input text-center text-2xl tracking-[0.5em] font-mono"
          placeholder="------"
        />

        <div className="flex items-center justify-between">
          <button
            onClick={request}
            disabled={cooldown > 0 || sending}
            className="text-xs text-brand-600 disabled:text-slate-400"
          >
            {cooldown > 0 ? `إعادة الإرسال خلال ${cooldown}ث` : 'إعادة إرسال الرمز'}
          </button>
          <button onClick={submit} disabled={sending} className="btn-primary text-sm">
            {sending ? <IconLoader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الاعتماد'}
          </button>
        </div>
      </div>
    </div>
  );
}
