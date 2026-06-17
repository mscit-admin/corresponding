'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconSparkles, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';
import { aiStatus, extractSubjectAI } from '@/lib/uploads';

const SUPPORTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];

/**
 * زر اختياري: يستخرج موضوع المراسلة من المستند المرفق (PDF/صورة) عبر الذكاء الاصطناعي
 * ويملأ حقل الموضوع. المُدخِل يقرّر استخدامه حسب نوع المستند — لا يعمل تلقائياً.
 */
export function AiSubjectButton({
  files,
  onExtracted,
}: {
  files: File[];
  onExtracted: (subject: string, summary: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const { data: enabled } = useQuery({
    queryKey: ['ai-status'],
    queryFn: aiStatus,
    staleTime: 5 * 60 * 1000,
  });

  // أخفِ الزر إن كانت الميزة غير مُفعّلة على الخادم
  if (enabled === false) return null;

  const candidate = files.find((f) => SUPPORTED.includes(f.type));

  const run = async () => {
    if (!candidate) {
      toast.error('أضِف مستند PDF أو صورة أولاً لاستخراج الموضوع');
      return;
    }
    try {
      setLoading(true);
      setSummary(null);
      const res = await extractSubjectAI(candidate);
      if (!res.subject) {
        toast.error('تعذّر استخراج موضوع واضح؛ يمكنك كتابته يدوياً');
        return;
      }
      onExtracted(res.subject, res.summary);
      setSummary(res.summary || null);
      toast.success(
        `تم استخراج الموضوع${res.confidence === 'low' ? ' (ثقة منخفضة — يُفضّل مراجعته)' : ''}`,
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'تعذّر تحليل المستند عبر الذكاء الاصطناعي');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={run}
          disabled={loading || !candidate}
          className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
        >
          {loading ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconSparkles className="w-3.5 h-3.5" />}
          {loading ? 'جارٍ تحليل المستند…' : 'استخراج الموضوع من المستند بالذكاء الاصطناعي'}
        </button>
        <span className="text-[10px] text-slate-400">
          {candidate ? `(${candidate.name})` : 'أضِف ملف PDF أو صورة لتفعيله'}
        </span>
      </div>
      {summary && (
        <div className="text-[11px] text-slate-600 bg-blue-50 border border-blue-100 rounded p-2 leading-relaxed">
          <span className="font-medium text-blue-800">ملخّص ذكي:</span> {summary}
        </div>
      )}
    </div>
  );
}
