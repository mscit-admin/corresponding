'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconSparkles, IconDeviceFloppy, IconPlugConnected, IconLoader2,
  IconCheck, IconX, IconAlertTriangle, IconRefresh, IconPlus, IconTrash,
  IconPencil, IconLock,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useAuthStore } from '@/store/auth';
import { canManageAiSettings } from '@/lib/permissions';
import { aiSettingsApi, AiProvider, AiProviderInput, AiProviderKind, AiSettings } from '@/lib/api';

const KIND_LABELS: Record<AiProviderKind, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'متوافق مع OpenAI',
};

export default function AiSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const allowed = canManageAiSettings(user?.roleName);

  const { data, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: aiSettingsApi.get,
    enabled: allowed,
  });

  const [enabled, setEnabled] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [defaultProviderId, setDefaultProviderId] = useState('');
  const [editing, setEditing] = useState<AiProvider | 'new' | null>(null);

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setPrompt(data.prompt);
      setDefaultProviderId(data.defaultProviderId || '');
    }
  }, [data]);

  const onSettings = (res: AiSettings) => {
    qc.setQueryData(['ai-settings'], res);
    qc.invalidateQueries({ queryKey: ['ai-status'] });
  };

  const saveGlobal = useMutation({
    mutationFn: () => aiSettingsApi.update({ enabled, prompt, defaultProviderId: defaultProviderId || undefined }),
    onSuccess: (res) => { onSettings(res); toast.success('تم حفظ الإعدادات'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'تعذّر حفظ الإعدادات'),
  });

  const removeProvider = useMutation({
    mutationFn: (id: string) => aiSettingsApi.deleteProvider(id),
    onSuccess: (res) => { onSettings(res); toast.success('تم حذف المزوّد'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'تعذّر حذف المزوّد'),
  });

  if (!allowed) {
    return (
      <AuthLayout>
        <div className="card max-w-lg mx-auto text-center py-10 space-y-3">
          <IconAlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-semibold">صلاحية غير كافية</h1>
          <p className="text-sm text-slate-500">هذه الشاشة مخصّصة لمديري النظام فقط.</p>
          <button onClick={() => router.push('/dashboard')} className="btn text-sm mx-auto">
            العودة للرئيسية
          </button>
        </div>
      </AuthLayout>
    );
  }

  const providers = data?.providers ?? [];

  return (
    <AuthLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <IconSparkles className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">إعدادات الذكاء الاصطناعي</h1>
            <p className="text-xs text-slate-500">
              أضِف مزوّدات الذكاء الاصطناعي يدوياً، ويختار المُدخِل المزوّد/الموديل لكل معاملة.
            </p>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="card flex items-center gap-2 text-sm text-slate-500">
            <IconLoader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل الإعدادات…
          </div>
        ) : (
          <>
            {/* الحالة العامة */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-semibold">تفعيل الميزة</div>
                  <div className="text-xs text-slate-500">
                    عند الإيقاف يختفي زر الاستخراج من شاشات الإدخال في كل النظام.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enabled ? 'bg-brand-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-1' : 'translate-x-6'
                  }`} />
                </button>
              </div>

              {providers.length === 0 && (
                <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 flex items-center gap-2">
                  <IconAlertTriangle className="w-4 h-4 shrink-0" />
                  لا يوجد مزوّد بعد — أضِف مزوّداً أدناه لتفعيل الميزة.
                </div>
              )}

              {providers.length > 1 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-600">المزوّد الافتراضي</div>
                  <select
                    className="input text-sm"
                    value={defaultProviderId}
                    onChange={(e) => setDefaultProviderId(e.target.value)}
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {KIND_LABELS[p.kind]}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    يُستخدم عند عدم اختيار المُدخِل لمزوّد محدّد أثناء الإدخال.
                  </p>
                </div>
              )}
            </div>

            {/* المزوّدات */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">المزوّدات</div>
                {editing === null && (
                  <button
                    type="button"
                    onClick={() => setEditing('new')}
                    className="btn text-xs inline-flex items-center gap-1"
                  >
                    <IconPlus className="w-3.5 h-3.5" /> إضافة مزوّد
                  </button>
                )}
              </div>

              {editing === 'new' && (
                <ProviderForm
                  modelSuggestions={data.modelSuggestions}
                  onDone={() => setEditing(null)}
                  onSettings={onSettings}
                />
              )}

              <div className="space-y-2">
                {providers.map((p) =>
                  editing !== 'new' && editing && editing.id === p.id ? (
                    <ProviderForm
                      key={p.id}
                      provider={p}
                      modelSuggestions={data.modelSuggestions}
                      onDone={() => setEditing(null)}
                      onSettings={onSettings}
                    />
                  ) : (
                    <div key={p.id} className="border border-slate-200 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {KIND_LABELS[p.kind]}
                          </span>
                          {p.locked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 inline-flex items-center gap-1">
                              <IconLock className="w-3 h-3" /> من البيئة
                            </span>
                          )}
                          {!p.enabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">معطّل</span>
                          )}
                        </div>
                        {!p.locked && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(p)}
                              className="text-xs text-slate-500 hover:text-brand-600 inline-flex items-center gap-1"
                            >
                              <IconPencil className="w-3.5 h-3.5" /> تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`حذف المزوّد "${p.name}"؟`)) removeProvider.mutate(p.id);
                              }}
                              className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                            >
                              <IconTrash className="w-3.5 h-3.5" /> حذف
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        المفتاح: <span className="font-mono">{p.keyMasked || '—'}</span>
                        {p.baseUrl && <> · <span className="font-mono">{p.baseUrl}</span></>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.models.map((m) => (
                          <span
                            key={m}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              m === p.defaultModel ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            {m}{m === p.defaultModel ? ' ★' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* نص التوجيه */}
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">نص التوجيه (Prompt)</div>
                <button
                  type="button"
                  onClick={() => setPrompt(data.defaultPrompt)}
                  className="text-xs text-slate-500 hover:text-brand-600 inline-flex items-center gap-1"
                >
                  <IconRefresh className="w-3.5 h-3.5" /> استعادة الافتراضي
                </button>
              </div>
              <textarea
                rows={10}
                className="input font-mono text-xs leading-relaxed"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <p className="text-[11px] text-slate-400">
                يجب أن يطلب النص ردّاً بصيغة JSON يحوي الحقول: subject و summary و confidence.
              </p>
            </div>

            {/* حفظ الإعدادات العامة */}
            <div className="card flex justify-end gap-2">
              <button
                type="button"
                onClick={() => saveGlobal.mutate()}
                disabled={saveGlobal.isPending}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {saveGlobal.isPending ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconDeviceFloppy className="w-4 h-4" />}
                حفظ الإعدادات العامة
              </button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

// ---------- نموذج إضافة/تعديل مزوّد ----------

function ProviderForm({
  provider,
  modelSuggestions,
  onDone,
  onSettings,
}: {
  provider?: AiProvider;
  modelSuggestions: AiSettings['modelSuggestions'];
  onDone: () => void;
  onSettings: (res: AiSettings) => void;
}) {
  const isEdit = !!provider;
  const [name, setName] = useState(provider?.name || '');
  const [kind, setKind] = useState<AiProviderKind>(provider?.kind || 'anthropic');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || '');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>(provider?.models || []);
  const [defaultModel, setDefaultModel] = useState(provider?.defaultModel || '');
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [modelInput, setModelInput] = useState('');
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  const addModel = (m: string) => {
    const v = m.trim();
    if (!v || models.includes(v)) return;
    const next = [...models, v];
    setModels(next);
    if (!defaultModel) setDefaultModel(v);
    setModelInput('');
  };
  const removeModel = (m: string) => {
    const next = models.filter((x) => x !== m);
    setModels(next);
    if (defaultModel === m) setDefaultModel(next[0] || '');
  };

  const body = (): AiProviderInput => ({
    name,
    kind,
    baseUrl: kind === 'openai' ? baseUrl : baseUrl || undefined,
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    models,
    defaultModel,
    enabled,
  });

  const save = useMutation({
    mutationFn: () => (isEdit
      ? aiSettingsApi.updateProvider(provider!.id, body())
      : aiSettingsApi.createProvider(body())),
    onSuccess: (res) => {
      onSettings(res);
      toast.success(isEdit ? 'تم تحديث المزوّد' : 'تمت إضافة المزوّد');
      onDone();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'تعذّر حفظ المزوّد'),
  });

  const testConn = useMutation({
    mutationFn: () => aiSettingsApi.test(isEdit ? provider!.id : 'new', {
      kind,
      baseUrl: kind === 'openai' ? baseUrl : baseUrl || undefined,
      apiKey: apiKey.trim() || undefined,
      model: defaultModel || models[0],
    }),
    onSuccess: (res) => { setTest(res); res.ok ? toast.success(res.message) : toast.error(res.message); },
    onError: (e: any) => {
      const m = e?.response?.data?.message || 'تعذّر اختبار الاتصال';
      setTest({ ok: false, message: m });
      toast.error(m);
    },
  });

  const suggestions = modelSuggestions[kind] || [];

  return (
    <div className="border border-brand-200 bg-brand-50/30 rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">اسم المزوّد</label>
          <input className="input text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: OpenAI الرئيسي" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">النوع</label>
          <select className="input text-sm" value={kind} onChange={(e) => setKind(e.target.value as AiProviderKind)}>
            <option value="anthropic">{KIND_LABELS.anthropic}</option>
            <option value="openai">{KIND_LABELS.openai}</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">
          عنوان الـ Base URL {kind === 'openai' ? '(مطلوب)' : '(اختياري)'}
        </label>
        <input
          className="input text-sm font-mono"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={kind === 'openai' ? 'https://api.openai.com/v1' : 'افتراضي Anthropic — اتركه فارغاً'}
        />
        {kind === 'openai' && (
          <p className="text-[11px] text-slate-400">
            أي خدمة متوافقة مع OpenAI API (DeepSeek، Mistral، Groq، Azure، نماذج محلية…). الاستخراج للصور فقط.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">مفتاح API</label>
        <input
          type="password"
          autoComplete="off"
          className="input text-sm font-mono"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isEdit ? `الحالي: ${provider?.keyMasked} — اتركه فارغاً للإبقاء` : 'أدخِل المفتاح'}
        />
      </div>

      {/* الموديلات */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">الموديلات</label>
        <div className="flex items-center gap-2">
          <input
            className="input text-sm font-mono"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModel(modelInput); } }}
            placeholder="اكتب معرّف الموديل واضغط Enter"
          />
          <button type="button" onClick={() => addModel(modelInput)} className="btn text-xs shrink-0">
            <IconPlus className="w-3.5 h-3.5" /> إضافة
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[11px] text-slate-400">اقتراحات:</span>
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => addModel(s.id)}
                disabled={models.includes(s.id)}
                className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 hover:border-brand-400 disabled:opacity-40 font-mono"
                title={s.label}
              >
                + {s.id}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {models.map((m) => (
            <span key={m} className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 font-mono">
              <button
                type="button"
                onClick={() => setDefaultModel(m)}
                className={defaultModel === m ? 'text-brand-600' : 'text-slate-300 hover:text-amber-500'}
                title="تعيين كافتراضي"
              >
                ★
              </button>
              {m}
              <button type="button" onClick={() => removeModel(m)} className="text-slate-400 hover:text-red-600">
                <IconX className="w-3 h-3" />
              </button>
            </span>
          ))}
          {models.length === 0 && <span className="text-[11px] text-slate-400">لم تُضَف موديلات بعد</span>}
        </div>
        {models.length > 0 && (
          <p className="text-[11px] text-slate-400">★ يحدّد الموديل الافتراضي ({defaultModel || '—'}).</p>
        )}
      </div>

      {/* تفعيل + اختبار + حفظ */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <label className="text-xs inline-flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          مُفعّل
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => testConn.mutate()}
            disabled={testConn.isPending}
            className="btn text-xs disabled:opacity-50"
          >
            {testConn.isPending ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconPlugConnected className="w-3.5 h-3.5" />}
            اختبار
          </button>
          <button type="button" onClick={onDone} className="btn text-xs">إلغاء</button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {save.isPending ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconDeviceFloppy className="w-3.5 h-3.5" />}
            {isEdit ? 'حفظ التعديلات' : 'إضافة المزوّد'}
          </button>
        </div>
      </div>
      {test && (
        <div className={`text-xs inline-flex items-center gap-1 ${test.ok ? 'text-green-600' : 'text-red-600'}`}>
          {test.ok ? <IconCheck className="w-4 h-4" /> : <IconX className="w-4 h-4" />}
          {test.message}
        </div>
      )}
    </div>
  );
}
