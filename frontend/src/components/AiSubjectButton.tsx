'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconSparkles, IconLoader2, IconCopy, IconCheck } from '@tabler/icons-react';
import { toast } from 'sonner';
import { aiStatus, extractSubjectAI } from '@/lib/uploads';

const SUPPORTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];

/**
 * زر اختياري: يستخرج موضوع المراسلة من المستند المرفق (PDF/صورة) عبر الذكاء الاصطناعي
 * ويملأ حقل الموضوع. المُدخِل يختار المزوّد/الموديل لكل معاملة — لا يعمل تلقائياً.
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
  const [fullText, setFullText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('');

  const { data: status } = useQuery({
    queryKey: ['ai-status'],
    queryFn: aiStatus,
    staleTime: 5 * 60 * 1000,
  });

  const providers = status?.providers ?? [];
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === providerId) ?? providers[0],
    [providers, providerId],
  );

  // اضبط المزوّد/الموديل الافتراضي عند توفّر الحالة
  useEffect(() => {
    if (!status?.enabled || providers.length === 0) return;
    const def = providers.find((p) => p.id === status.defaultProviderId) ?? providers[0];
    setProviderId((cur) => (providers.some((p) => p.id === cur) ? cur : def.id));
  }, [status, providers]);

  useEffect(() => {
    if (!selectedProvider) return;
    setModel((cur) => (selectedProvider.models.includes(cur) ? cur : selectedProvider.defaultModel));
  }, [selectedProvider]);

  // أخفِ الزر إن كانت الميزة غير مُفعّلة على الخادم
  if (status?.enabled === false) return null;

  const candidate = files.find((f) => SUPPORTED.includes(f.type));
  const multipleProviders = providers.length > 1;
  const multipleModels = (selectedProvider?.models.length ?? 0) > 1;

  const run = async () => {
    if (!candidate) {
      toast.error('أضِف مستند PDF أو صورة أولاً لاستخراج الموضوع');
      return;
    }
    try {
      setLoading(true);
      setSummary(null);
      setFullText(null);
      setCopied(false);
      const res = await extractSubjectAI(candidate, {
        providerId: selectedProvider?.id,
        model: model || selectedProvider?.defaultModel,
      });
      setFullText(res.fullText || null);
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

      {/* اختيار المزوّد/الموديل لهذه المعاملة (يظهر فقط عند توفّر خيارات متعددة) */}
      {(multipleProviders || multipleModels) && (
        <div className="flex items-center gap-2 flex-wrap">
          {multipleProviders && (
            <select
              className="input text-[11px] py-1 px-2 h-auto w-auto"
              value={selectedProvider?.id ?? ''}
              onChange={(e) => setProviderId(e.target.value)}
              disabled={loading}
              title="المزوّد"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {multipleModels && (
            <select
              className="input text-[11px] py-1 px-2 h-auto w-auto"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              title="الموديل"
            >
              {selectedProvider?.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {summary && (
        <div className="text-[11px] text-slate-600 bg-blue-50 border border-blue-100 rounded p-2 leading-relaxed">
          <span className="font-medium text-blue-800">ملخّص ذكي:</span> {summary}
        </div>
      )}

      {fullText && (
        <div className="border border-slate-200 rounded p-2 space-y-1.5 bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-700">النص الكامل المستخرج</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(fullText);
                  setCopied(true);
                  toast.success('تم نسخ النص الكامل');
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  toast.error('تعذّر النسخ');
                }
              }}
              className="text-[11px] text-brand-600 hover:underline inline-flex items-center gap-1"
            >
              {copied ? <IconCheck className="w-3.5 h-3.5" /> : <IconCopy className="w-3.5 h-3.5" />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
          </div>
          <textarea
            readOnly
            value={fullText}
            rows={8}
            className="input text-[11px] leading-relaxed font-sans w-full bg-white"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
