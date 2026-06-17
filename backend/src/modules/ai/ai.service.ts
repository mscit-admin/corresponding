import {
  Injectable, Logger, BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
const PDF_TYPE = 'application/pdf';

// مفاتيح التخزين في جدول system_settings
const K_ENABLED = 'ai.enabled';
const K_API_KEY = 'ai.apiKey';
const K_MODEL = 'ai.model';
const K_PROMPT = 'ai.prompt';

export const DEFAULT_MODEL = 'claude-opus-4-8';

export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — الأدق (موصى به للمستندات الصعبة)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — متوازن (سرعة/دقة)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — الأسرع والأرخص' },
];

export const DEFAULT_PROMPT = `أنت مساعد أرشفة إلكترونية في ديوان حكومي. المرفق هو مستند لمراسلة واردة رسمية (غالباً بالعربية).
حلّل محتواه واستخرج المعلومات التالية، وأعد ردّك حصراً ككائن JSON صالح بدون أي نص قبله أو بعده وبدون علامات code block:
{
  "subject": "موضوع المراسلة في جملة واحدة موجزة ودقيقة تصلح لحقل (الموضوع)، بدون كلمة الموضوع وبدون نقطتين",
  "summary": "ملخّص من سطر إلى سطرين لأهم ما ورد في المراسلة",
  "confidence": "high أو medium أو low حسب وضوح المستند وقابليته للقراءة"
}
اكتب قيمتي subject و summary بالعربية الفصحى.`;

export interface SubjectExtraction {
  subject: string;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ResolvedAiConfig {
  apiKey: string;
  model: string;
  prompt: string;
  enabled: boolean;
  hasKey: boolean;
  keySource: 'db' | 'env' | 'none';
}

/**
 * يقرأ إعدادات الذكاء الاصطناعي من قاعدة البيانات (مع الرجوع لمتغيرات البيئة)،
 * ويستخدم Claude متعدد الوسائط لقراءة مستند المراسلة الوارد واستخراج موضوعه وملخّصه.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  // ---------- قراءة/كتابة الإعدادات ----------

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

  /** يدمج إعدادات قاعدة البيانات مع متغيّرات البيئة (DB له الأولوية). */
  async resolveConfig(): Promise<ResolvedAiConfig> {
    const dbKey = await this.getRaw(K_API_KEY);
    const envKey = this.config.get<string>('ai.apiKey') || '';
    const apiKey = (dbKey || envKey || '').trim();

    const model = (await this.getRaw(K_MODEL)) || this.config.get<string>('ai.model') || DEFAULT_MODEL;
    const prompt = (await this.getRaw(K_PROMPT)) || DEFAULT_PROMPT;
    const enabledRaw = await this.getRaw(K_ENABLED);
    // التفعيل افتراضياً مُمكَّن إن وُجد مفتاح، ما لم يُعطَّل صراحةً
    const enabled = (enabledRaw === null ? true : enabledRaw === 'true') && !!apiKey;

    return {
      apiKey,
      model,
      prompt,
      enabled,
      hasKey: !!apiKey,
      keySource: dbKey ? 'db' : envKey ? 'env' : 'none',
    };
  }

  /** الحالة العامة (للواجهة لإظهار/إخفاء زر الاستخراج). */
  async status(): Promise<{ enabled: boolean }> {
    return { enabled: (await this.resolveConfig()).enabled };
  }

  /** عرض الإعدادات للأدمن (المفتاح مُقنّع). */
  async getAdminSettings() {
    const c = await this.resolveConfig();
    return {
      enabled: c.enabled,
      hasKey: c.hasKey,
      keySource: c.keySource,
      keyMasked: c.apiKey ? this.mask(c.apiKey) : '',
      keyLocked: c.keySource === 'env', // المفتاح من البيئة لا يُعدَّل من الواجهة
      model: c.model,
      prompt: c.prompt,
      defaultPrompt: DEFAULT_PROMPT,
      availableModels: AVAILABLE_MODELS,
    };
  }

  /** تحديث الإعدادات. يتم تجاهل الحقول غير المُرسلة. */
  async updateSettings(body: {
    enabled?: boolean;
    model?: string;
    prompt?: string;
    apiKey?: string;
    clearKey?: boolean;
  }) {
    if (body.enabled !== undefined) await this.set(K_ENABLED, body.enabled ? 'true' : 'false');

    if (body.model !== undefined) {
      if (!AVAILABLE_MODELS.some((m) => m.id === body.model)) {
        throw new BadRequestException('النموذج المحدد غير معروف');
      }
      await this.set(K_MODEL, body.model);
    }

    if (body.prompt !== undefined) {
      await this.set(K_PROMPT, body.prompt.trim() || DEFAULT_PROMPT);
    }

    if (body.clearKey) {
      await this.prisma.systemSetting.deleteMany({ where: { key: K_API_KEY } });
    } else if (
      body.apiKey !== undefined &&
      body.apiKey.trim() !== '' &&
      !body.apiKey.includes('•') // قيمة مُقنّعة لم تتغيّر — لا تُحفظ
    ) {
      await this.set(K_API_KEY, body.apiKey.trim());
    }

    return this.getAdminSettings();
  }

  /** اختبار صحة المفتاح والاتصال بـAnthropic. */
  async testConnection(apiKeyOverride?: string): Promise<{ ok: boolean; message: string }> {
    const c = await this.resolveConfig();
    const key =
      apiKeyOverride && apiKeyOverride.trim() && !apiKeyOverride.includes('•')
        ? apiKeyOverride.trim()
        : c.apiKey;
    if (!key) return { ok: false, message: 'لا يوجد مفتاح API محفوظ لاختباره' };

    try {
      const client = new Anthropic({ apiKey: key });
      await client.messages.create({
        model: c.model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'قل: تم' }],
      });
      return { ok: true, message: 'تم الاتصال بنجاح ✓ المفتاح والنموذج يعملان.' };
    } catch (e: any) {
      const status = e?.status;
      let message = e?.message || 'فشل الاتصال';
      if (status === 401) message = 'المفتاح غير صالح (401) — تحقّق منه.';
      else if (status === 404) message = 'النموذج غير متاح لهذا المفتاح (404).';
      else if (status === 429) message = 'تم تجاوز حدّ الاستخدام (429) — حاول لاحقاً.';
      return { ok: false, message };
    }
  }

  // ---------- الاستخراج ----------

  async extractSubject(file: Express.Multer.File): Promise<SubjectExtraction> {
    const c = await this.resolveConfig();
    if (!c.enabled || !c.apiKey) {
      throw new ServiceUnavailableException(
        'خدمة الذكاء الاصطناعي غير مُفعّلة — راجع إعدادات الذكاء الاصطناعي',
      );
    }
    if (!file?.buffer) throw new BadRequestException('لم يتم تحديد ملف');

    const mime = file.mimetype;
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

    try {
      const client = new Anthropic({ apiKey: c.apiKey });
      const response = await client.messages.create({
        model: c.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: c.prompt }] }],
      } as any);

      const textBlock: any = response.content.find((b: any) => b.type === 'text');
      return this.parse((textBlock?.text || '').trim());
    } catch (e: any) {
      this.logger.error(`AI extraction failed: ${e?.message}`);
      throw new ServiceUnavailableException(
        'تعذّر تحليل المستند عبر الذكاء الاصطناعي، حاول مجدداً أو أدخِل الموضوع يدوياً',
      );
    }
  }

  // ---------- أدوات ----------

  private mask(key: string): string {
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
