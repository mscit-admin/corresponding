import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): nodemailer.Transporter | null {
    if (this.initialized) return this.transporter;
    this.initialized = true;
    const host = this.config.get<string>('mail.host');
    if (!host) {
      this.logger.warn('SMTP غير مُهيّأ — سيُسجَّل رمز التحقّق في السجلّ بدل إرساله (وضع التطوير).');
      this.transporter = null;
      return null;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('mail.port') || 587,
      secure: !!this.config.get<boolean>('mail.secure'),
      auth: this.config.get<string>('mail.user')
        ? { user: this.config.get<string>('mail.user'), pass: this.config.get<string>('mail.pass') }
        : undefined,
    });
    return this.transporter;
  }

  /** هل البريد مُهيّأ فعلاً للإرسال؟ */
  isConfigured(): boolean {
    return !!this.config.get<string>('mail.host');
  }

  /** يرسل بريداً. يعيد true عند الإرسال الفعلي، false في وضع التطوير (تسجيل فقط). */
  async send(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    const t = this.getTransporter();
    const from = this.config.get<string>('mail.from');
    if (!t) {
      this.logger.log(`[DEV MAIL] إلى: ${to} | ${subject}\n${text}`);
      return false;
    }
    await t.sendMail({ from, to, subject, text, html });
    return true;
  }
}
