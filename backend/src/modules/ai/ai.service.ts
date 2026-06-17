import {
  Injectable, Logger, BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
const PDF_TYPE = 'application/pdf';

export interface SubjectExtraction {
  subject: string;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * يستخدم Claude (متعدد الوسائط) لقراءة مستند المراسلة الوارد (PDF/صورة)
 * واستخراج موضوعها وملخّصها — لتسهيل إدخال البيانات على الموظف.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null = null;
  private readonly model: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('ai.apiKey');
    this.model = this.config.get<string>('ai.model') || 'claude-opus-4-8';
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('AI subject extraction enabled');
    } else {
      this.logger.warn('AI subject extraction disabled (ANTHROPIC_API_KEY not set)');
    }
  }

  get enabled(): boolean {
    return !!this.client;
  }

  async extractSubject(file: Express.Multer.File): Promise<SubjectExtraction> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'خدمة الذكاء الاصطناعي غير مُفعّلة على الخادم (لم يُضبط مفتاح API)',
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
        source: { type: 'base64', media_type: mime === 'image/jpg' ? 'image/jpeg' : mime, data: file.buffer.toString('base64') },
      };
    } else {
      throw new BadRequestException('الاستخراج التلقائي مدعوم لملفات PDF والصور فقط');
    }

    const prompt = `أنت مساعد أرشفة إلكترونية في ديوان حكومي. المرفق هو مستند لمراسلة واردة رسمية (غالباً بالعربية).
حلّل محتواه واستخرج المعلومات التالية، وأعد ردّك حصراً ككائن JSON صالح بدون أي نص قبله أو بعده وبدون علامات code block:
{
  "subject": "موضوع المراسلة في جملة واحدة موجزة ودقيقة تصلح لحقل (الموضوع)، بدون كلمة الموضوع وبدون نقطتين",
  "summary": "ملخّص من سطر إلى سطرين لأهم ما ورد في المراسلة",
  "confidence": "high أو medium أو low حسب وضوح المستند وقابليته للقراءة"
}
اكتب قيمتي subject و summary بالعربية الفصحى.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: prompt }] }],
      } as any);

      const textBlock: any = response.content.find((b: any) => b.type === 'text');
      const raw = (textBlock?.text || '').trim();
      return this.parse(raw);
    } catch (e: any) {
      this.logger.error(`AI extraction failed: ${e?.message}`);
      throw new ServiceUnavailableException('تعذّر تحليل المستند عبر الذكاء الاصطناعي، حاول مجدداً أو أدخِل الموضوع يدوياً');
    }
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
