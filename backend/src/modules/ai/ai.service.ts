import {
  Injectable, Logger, BadRequestException, ServiceUnavailableException, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
const PDF_TYPE = 'application/pdf';

// مفاتيح التخزين في جدول system_settings
const K_ENABLED = 'ai.enabled';
const K_PROMPT = 'ai.prompt';
const K_PROVIDERS = 'ai.providers';
const K_DEFAULT_PROVIDER = 'ai.defaultProviderId';

// مفاتيح قديمة (مزوّد واحد) — تُرحَّل تلقائياً عند أول قراءة
const K_LEGACY_API_KEY = 'ai.apiKey';
const K_LEGACY_MODEL = 'ai.model';

export type ProviderKind = 'anthropic' | 'openai';

/** معرّف المزوّد المُشتق من متغيّرات البيئة (مقفول، لا يُحذف من الواجهة). */
const ENV_PROVIDER_ID = 'env';

export const DEFAULT_MODEL = 'claude-opus-4-8';

/** اقتراحات موديلات تُعرض للأدمن لكل نوع — وله إضافة أي موديل يدوياً. */
export const MODEL_SUGGESTIONS: Record<ProviderKind, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — الأدق' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — متوازن' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — الأسرع/الأرخص' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
};

export const DEFAULT_PROMPT = `أنت مساعد أرشفة إلكترونية في ديوان حكومي. المرفق مستند لمراسلة واردة رسمية (غالباً بالعربية).
اقرأ المستند كاملاً بعناية واستخرج المعلومات التالية، وأعد ردّك حصراً ككائن JSON صالح بدون أي نص قبله أو بعده وبدون علامات code block:
{
  "subject": "موضوع المراسلة في جملة واحدة موجزة ودقيقة تصلح لحقل (الموضوع)، بدون كلمة الموضوع وبدون نقطتين",
  "summary": "ملخّص وافٍ ومعبّر في فقرة من 5 إلى 8 جُمل بالعربية الفصحى يغطّي مضمون المراسلة بالكامل، ويشمل: الجهة المُرسِلة والمُرسَل إليها إن ذُكرتا، الغرض الرئيسي، أهم النقاط والطلبات والقرارات، أي تواريخ أو أرقام أو مهل أو مراجع مهمة، والإجراء المطلوب. اكتبه بأسلوب رسمي واضح ولا تختصره اختصاراً مخلّاً",
  "confidence": "high أو medium أو low حسب وضوح المستند"
}
اكتب قيمتي subject و summary بالعربية الفصحى.`;

export interface SubjectExtraction {
  subject: string;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

/** مزوّد كما يُخزَّن في قاعدة البيانات (يتضمّن المفتاح). */
interface StoredProvider {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl?: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
  enabled: boolean;
}

/** مزوّد محلول للاستخدام (يدمج مزوّد البيئة المقفول). */
interface ResolvedProvider extends StoredProvider {
  locked: boolean;
  keySource: 'db' | 'env';
}

/**
 * يدير عدّة مزوّدات للذكاء الاصطناعي يضيفها الأدمن يدوياً (Anthropic أو أي خدمة
 * متوافقة مع OpenAI API)، ويستخدم المزوّد/الموديل المختار لقراءة مستند المراسلة
 * الوارد واستخراج موضوعه وملخّصه.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  // ---------- قراءة/كتابة منخفضة المستوى ----------

  private async getRaw(key: string): Promise<string | null> {
    try {
      const row = await this.prisma.systemSetting.findUnique({ where: { key } });
      return row?.value ?? null;
    } catch {
      return null; // الجدول قد لا يكون موجوداً بعد (قبل أول db push)
    }
  }

  private async set(key: string, value: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  // ---------- إدارة المزوّدات ----------

  /** يقرأ المزوّدات المُخزَّنة، مع ترحيل الإعداد القديم (مزوّد واحد) إن وُجد. */
  private async readStoredProviders(): Promise<StoredProvider[]> {
    const raw = await this.getRaw(K_PROVIDERS);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.map((p) => this.normalize(p)).filter(Boolean) as StoredProvider[];
      } catch {
        this.logger.warn('تعذّر تحليل قائمة المزوّدات المخزّنة');
      }
    }

    // ترحيل: مفتاح/موديل قديم محفوظ في قاعدة البيانات → مزوّد Anthropic واحد
    const legacyKey = (await this.getRaw(K_LEGACY_API_KEY))?.trim();
    if (legacyKey) {
      const legacyModel = (await this.getRaw(K_LEGACY_MODEL)) || DEFAULT_MODEL;
      const migrated: StoredProvider[] = [
        {
          id: nanoid(8),
          name: 'Anthropic',
          kind: 'anthropic',
          apiKey: legacyKey,
          models: [legacyModel],
          defaultModel: legacyModel,
          enabled: true,
        },
      ];
      await this.writeStoredProviders(migrated);
      await this.prisma.systemSetting.deleteMany({
        where: { key: { in: [K_LEGACY_API_KEY, K_LEGACY_MODEL] } },
      });
      return migrated;
    }

    return [];
  }

  private normalize(p: any): StoredProvider | null {
    if (!p || typeof p !== 'object' || !p.id) return null;
    const kind: ProviderKind = p.kind === 'openai' ? 'openai' : 'anthropic';
    const models: string[] = Array.isArray(p.models)
      ? p.models.map((m: any) => String(m).trim()).filter(Boolean)
      : [];
    return {
      id: String(p.id),
      name: String(p.name || 'مزوّد').trim(),
      kind,
      baseUrl: p.baseUrl ? String(p.baseUrl).trim() : undefined,
      apiKey: String(p.apiKey || ''),
      models,
      defaultModel: String(p.defaultModel || models[0] || '').trim(),
      enabled: p.enabled !== false,
    };
  }

  private async writeStoredProviders(list: StoredProvider[]): Promise<void> {
    await this.set(K_PROVIDERS, JSON.stringify(list));
  }

  /** يبني المزوّد المُشتق من متغيّرات البيئة (إن وُجد مفتاح ANTHROPIC_API_KEY). */
  private envProvider(): ResolvedProvider | null {
    const key = (this.config.get<string>('ai.apiKey') || '').trim();
    if (!key) return null;
    const model = this.config.get<string>('ai.model') || DEFAULT_MODEL;
    return {
      id: ENV_PROVIDER_ID,
      name: 'Anthropic (من متغيّرات البيئة)',
      kind: 'anthropic',
      apiKey: key,
      models: [model],
      defaultModel: model,
      enabled: true,
      locked: true,
      keySource: 'env',
    };
  }

  /** كل المزوّدات الصالحة للاستخدام = مزوّد البيئة (إن وُجد) + المزوّدات المخزّنة المُفعّلة بمفتاح. */
  private async resolveProviders(): Promise<ResolvedProvider[]> {
    const stored = await this.readStoredProviders();
    const resolved: ResolvedProvider[] = [];
    const env = this.envProvider();
    if (env) resolved.push(env);
    for (const p of stored) {
      if (p.enabled && p.apiKey && p.defaultModel) {
        resolved.push({ ...p, locked: false, keySource: 'db' });
      }
    }
    return resolved;
  }

  private async globalEnabled(): Promise<boolean> {
    const raw = await this.getRaw(K_ENABLED);
    // مُفعّل افتراضياً ما لم يُعطَّل صراحةً
    return raw === null ? true : raw === 'true';
  }

  // ---------- الحالة العامة (للواجهة) ----------

  /**
   * تُستخدم في شاشات الإدخال: هل الميزة مُفعّلة، وما المزوّدات/الموديلات المتاحة
   * ليختار منها المُدخِل لكل معاملة (بدون أي مفاتيح).
   */
  async status(): Promise<{
    enabled: boolean;
    defaultProviderId: string | null;
    providers: { id: string; name: string; kind: ProviderKind; models: string[]; defaultModel: string }[];
  }> {
    const enabled = await this.globalEnabled();
    const providers = await this.resolveProviders();
    const usable = enabled && providers.length > 0;
    const defaultId = await this.pickDefaultProviderId(providers);
    return {
      enabled: usable,
      defaultProviderId: usable ? defaultId : null,
      providers: usable
        ? providers.map((p) => ({
            id: p.id, name: p.name, kind: p.kind, models: p.models, defaultModel: p.defaultModel,
          }))
        : [],
    };
  }

  private async pickDefaultProviderId(providers: ResolvedProvider[]): Promise<string | null> {
    if (!providers.length) return null;
    const saved = await this.getRaw(K_DEFAULT_PROVIDER);
    if (saved && providers.some((p) => p.id === saved)) return saved;
    return providers[0].id;
  }

  // ---------- إعدادات الأدمن ----------

  /** عرض كامل الإعدادات للأدمن (المفاتيح مُقنّعة). */
  async getAdminSettings() {
    const enabled = await this.globalEnabled();
    const prompt = (await this.getRaw(K_PROMPT)) || DEFAULT_PROMPT;
    const stored = await this.readStoredProviders();
    const env = this.envProvider();
    const defaultProviderId = await this.pickDefaultProviderId(await this.resolveProviders());

    const list = [
      ...(env
        ? [{
            id: env.id, name: env.name, kind: env.kind, baseUrl: '',
            models: env.models, defaultModel: env.defaultModel,
            enabled: true, locked: true, keyMasked: this.mask(env.apiKey),
          }]
        : []),
      ...stored.map((p) => ({
        id: p.id, name: p.name, kind: p.kind, baseUrl: p.baseUrl || '',
        models: p.models, defaultModel: p.defaultModel,
        enabled: p.enabled, locked: false,
        keyMasked: p.apiKey ? this.mask(p.apiKey) : '',
      })),
    ];

    return {
      enabled,
      prompt,
      defaultPrompt: DEFAULT_PROMPT,
      defaultProviderId,
      providers: list,
      modelSuggestions: MODEL_SUGGESTIONS,
    };
  }

  /** تحديث الإعدادات العامة (التفعيل، نص التوجيه، المزوّد الافتراضي). */
  async updateSettings(body: { enabled?: boolean; prompt?: string; defaultProviderId?: string }) {
    if (body.enabled !== undefined) await this.set(K_ENABLED, body.enabled ? 'true' : 'false');
    if (body.prompt !== undefined) await this.set(K_PROMPT, body.prompt.trim() || DEFAULT_PROMPT);
    if (body.defaultProviderId !== undefined) await this.set(K_DEFAULT_PROVIDER, body.defaultProviderId);
    return this.getAdminSettings();
  }

  // ---------- CRUD للمزوّدات ----------

  private validateInput(body: any, existing?: StoredProvider): StoredProvider {
    const kind: ProviderKind = body.kind === 'openai' ? 'openai' : 'anthropic';
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('اسم المزوّد مطلوب');

    const models: string[] = Array.isArray(body.models)
      ? Array.from(new Set(body.models.map((m: any) => String(m).trim()).filter(Boolean)))
      : existing?.models || [];
    if (!models.length) throw new BadRequestException('أضِف موديلاً واحداً على الأقل');

    const defaultModel = String(body.defaultModel || '').trim() || models[0];
    if (!models.includes(defaultModel)) {
      throw new BadRequestException('الموديل الافتراضي يجب أن يكون ضمن قائمة الموديلات');
    }

    let baseUrl = body.baseUrl !== undefined ? this.sanitizeUrl(body.baseUrl) : existing?.baseUrl || '';
    if (kind === 'openai' && !baseUrl) {
      baseUrl = 'https://api.openai.com/v1';
    }

    // المفتاح: قيمة جديدة فقط إن لم تكن مُقنّعة/فارغة، وإلا أبقِ القديم
    let apiKey = existing?.apiKey || '';
    if (typeof body.apiKey === 'string' && body.apiKey.trim() && !body.apiKey.includes('•')) {
      apiKey = body.apiKey.trim();
    }
    if (!apiKey) throw new BadRequestException('مفتاح API مطلوب');

    return {
      id: existing?.id || nanoid(8),
      name,
      kind,
      baseUrl: baseUrl || undefined,
      apiKey,
      models,
      defaultModel,
      enabled: body.enabled !== undefined ? !!body.enabled : existing?.enabled ?? true,
    };
  }

  async createProvider(body: any) {
    const stored = await this.readStoredProviders();
    const provider = this.validateInput(body);
    stored.push(provider);
    await this.writeStoredProviders(stored);
    return this.getAdminSettings();
  }

  async updateProvider(id: string, body: any) {
    if (id === ENV_PROVIDER_ID) throw new BadRequestException('مزوّد البيئة مقفول ولا يُعدَّل من الواجهة');
    const stored = await this.readStoredProviders();
    const idx = stored.findIndex((p) => p.id === id);
    if (idx === -1) throw new NotFoundException('المزوّد غير موجود');
    stored[idx] = this.validateInput(body, stored[idx]);
    await this.writeStoredProviders(stored);
    return this.getAdminSettings();
  }

  async deleteProvider(id: string) {
    if (id === ENV_PROVIDER_ID) throw new BadRequestException('مزوّد البيئة مقفول ولا يُحذف من الواجهة');
    const stored = await this.readStoredProviders();
    const next = stored.filter((p) => p.id !== id);
    if (next.length === stored.length) throw new NotFoundException('المزوّد غير موجود');
    await this.writeStoredProviders(next);
    return this.getAdminSettings();
  }

  /** اختبار اتصال مزوّد محفوظ (أو مفتاح مُمرَّر مع بيانات مزوّد غير محفوظ بعد). */
  async testProvider(id: string, body: any): Promise<{ ok: boolean; message: string }> {
    let provider: { kind: ProviderKind; baseUrl?: string; apiKey: string; model: string } | null = null;

    if (id && id !== 'new') {
      const all = await this.resolveProviders();
      const found = all.find((p) => p.id === id) ||
        (await this.readStoredProviders()).find((p) => p.id === id);
      if (!found) throw new NotFoundException('المزوّد غير موجود');
      // اسمح بتجاوز المفتاح/الموديل من النموذج قبل الحفظ
      const key = typeof body?.apiKey === 'string' && body.apiKey.trim() && !body.apiKey.includes('•')
        ? body.apiKey.trim() : found.apiKey;
      provider = {
        kind: found.kind,
        baseUrl: body?.baseUrl ? this.sanitizeUrl(body.baseUrl) : found.baseUrl,
        apiKey: key,
        model: body?.model?.trim() || found.defaultModel,
      };
    } else {
      // مزوّد جديد لم يُحفظ بعد
      const kind: ProviderKind = body?.kind === 'openai' ? 'openai' : 'anthropic';
      provider = {
        kind,
        baseUrl: body?.baseUrl ? this.sanitizeUrl(body.baseUrl) : (kind === 'openai' ? 'https://api.openai.com/v1' : undefined),
        apiKey: String(body?.apiKey || '').trim(),
        model: String(body?.model || '').trim(),
      };
    }

    if (!provider.apiKey || provider.apiKey.includes('•')) {
      return { ok: false, message: 'لا يوجد مفتاح API صالح لاختباره' };
    }
    if (!provider.model) return { ok: false, message: 'حدّد موديلاً لاختباره' };

    try {
      if (provider.kind === 'anthropic') {
        const client = new Anthropic({ apiKey: provider.apiKey, ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}) });
        await client.messages.create({
          model: provider.model,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'قل: تم' }],
        });
      } else {
        await this.openaiChat(provider.baseUrl!, provider.apiKey, provider.model, [
          { type: 'text', text: 'قل: تم' },
        ], 16);
      }
      return { ok: true, message: 'تم الاتصال بنجاح ✓ المفتاح والموديل يعملان.' };
    } catch (e: any) {
      return { ok: false, message: this.friendlyError(e) };
    }
  }

  // ---------- الاستخراج ----------

  async extractSubject(
    file: Express.Multer.File,
    opts?: { providerId?: string; model?: string },
  ): Promise<SubjectExtraction> {
    if (!(await this.globalEnabled())) {
      throw new ServiceUnavailableException('خدمة الذكاء الاصطناعي غير مُفعّلة — راجع إعدادات الذكاء الاصطناعي');
    }
    if (!file?.buffer) throw new BadRequestException('لم يتم تحديد ملف');

    const providers = await this.resolveProviders();
    if (!providers.length) {
      throw new ServiceUnavailableException('لا يوجد مزوّد ذكاء اصطناعي مُفعّل — أضِف مزوّداً من الإعدادات');
    }

    const wantedId = opts?.providerId || (await this.pickDefaultProviderId(providers));
    const provider = providers.find((p) => p.id === wantedId) || providers[0];
    const model = (opts?.model && provider.models.includes(opts.model)) ? opts.model : provider.defaultModel;

    const prompt = (await this.getRaw(K_PROMPT)) || DEFAULT_PROMPT;
    const mime = file.mimetype;

    try {
      let raw: string;
      if (provider.kind === 'anthropic') {
        raw = await this.runAnthropic(provider, model, prompt, file, mime);
      } else {
        raw = await this.runOpenAi(provider, model, prompt, file, mime);
      }
      return this.parse(raw.trim());
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`AI extraction failed (${provider.kind}/${model}): ${e?.message}`);
      throw new ServiceUnavailableException(
        'تعذّر تحليل المستند عبر الذكاء الاصطناعي، حاول مجدداً أو جرّب مزوّداً آخر أو أدخِل الموضوع يدوياً',
      );
    }
  }

  private async runAnthropic(
    p: ResolvedProvider, model: string, prompt: string, file: Express.Multer.File, mime: string,
  ): Promise<string> {
    let mediaBlock: any;
    if (mime === PDF_TYPE) {
      mediaBlock = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.buffer.toString('base64') },
      };
    } else if (IMAGE_TYPES.includes(mime)) {
      mediaBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mime === 'image/jpg' ? 'image/jpeg' : mime,
          data: file.buffer.toString('base64'),
        },
      };
    } else {
      throw new BadRequestException('الاستخراج التلقائي مدعوم لملفات PDF والصور فقط');
    }

    const client = new Anthropic({ apiKey: p.apiKey, ...(p.baseUrl ? { baseURL: p.baseUrl } : {}) });
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: prompt }] }],
    } as any);
    const textBlock: any = response.content.find((b: any) => b.type === 'text');
    return textBlock?.text || '';
  }

  private async runOpenAi(
    p: ResolvedProvider, model: string, prompt: string, file: Express.Multer.File, mime: string,
  ): Promise<string> {
    if (mime === PDF_TYPE) {
      throw new BadRequestException(
        'هذا المزوّد (متوافق مع OpenAI) يدعم الصور فقط للاستخراج — لملفات PDF استخدم مزوّد Anthropic',
      );
    }
    if (!IMAGE_TYPES.includes(mime)) {
      throw new BadRequestException('الاستخراج التلقائي مدعوم لملفات PDF والصور فقط');
    }
    const dataUrl = `data:${mime === 'image/jpg' ? 'image/jpeg' : mime};base64,${file.buffer.toString('base64')}`;
    return this.openaiChat(p.baseUrl!, p.apiKey, model, [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: dataUrl } },
    ], 1024);
  }

  /** نداء عام لواجهة /chat/completions المتوافقة مع OpenAI (عبر fetch). */
  private async openaiChat(
    baseUrl: string, apiKey: string, model: string, content: any[], maxTokens: number,
  ): Promise<string> {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err: any = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    const json: any = await res.json();
    return json?.choices?.[0]?.message?.content || '';
  }

  // ---------- أدوات ----------

  private friendlyError(e: any): string {
    const status = e?.status;
    if (status === 401 || status === 403) return 'المفتاح غير صالح أو غير مصرّح (401/403) — تحقّق منه.';
    if (status === 404) return 'الموديل أو المسار غير متاح (404) — تحقّق من اسم الموديل وعنوان الـURL.';
    if (status === 429) return 'تم تجاوز حدّ الاستخدام (429) — حاول لاحقاً.';
    return e?.message || 'فشل الاتصال';
  }

  /**
   * ينظّف عنوان الـURL: يزيل كل المسافات وأي رموز/أحرف غير مسموح بها في الروابط
   * (مثل ✅ التي قد تُلصَق بالخطأ)، ويزيل الشرطة الأخيرة.
   */
  private sanitizeUrl(raw: any): string {
    let url = String(raw || '').trim();
    url = url.replace(/\s+/g, ''); // إزالة كل المسافات (الداخلية والطرفية)
    // أبقِ فقط الأحرف الصالحة في الروابط؛ يُزيل الإيموجي والرموز الغريبة
    url = url.replace(/[^A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/g, '');
    url = url.replace(/\/+$/, ''); // إزالة الشرطة الأخيرة
    return url;
  }

  private mask(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
  }

  /** يحلّل رد النموذج إلى JSON بمرونة (يزيل code fences إن وُجدت). */
  private parse(raw: string): SubjectExtraction {
    let text = raw;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    else {
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if (first !== -1 && last !== -1) text = text.slice(first, last + 1);
    }
    try {
      const p = JSON.parse(text);
      const conf = ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'low';
      return {
        subject: String(p.subject || '').trim(),
        summary: String(p.summary || '').trim(),
        confidence: conf,
      };
    } catch {
      return { subject: '', summary: raw.slice(0, 500), confidence: 'low' };
    }
  }
}
