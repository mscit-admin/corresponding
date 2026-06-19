import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';

const CODE_TTL_MS = 10 * 60 * 1000; // صلاحية الرمز 10 دقائق
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    const head = name.length <= 2 ? name[0] || '' : name.slice(0, 2);
    return `${head}${'*'.repeat(Math.max(1, name.length - head.length))}@${domain}`;
  }

  /** يولّد رمزاً من 6 أرقام ويُرسله لبريد المستخدم. */
  async requestCode(userId: bigint | string, purpose: string): Promise<{
    sentTo: string;
    delivered: boolean;
    expiresInSec: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { email: true, fullName: true, fullNameAr: true },
    });
    if (!user?.email) {
      throw new BadRequestException('لا يوجد بريد إلكتروني مسجّل لحسابك. راجع مدير النظام.');
    }

    // أبطل الرموز السابقة غير المستهلكة لنفس الغرض
    await this.prisma.otpCode.deleteMany({
      where: { userId: BigInt(userId), purpose, consumedAt: null },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 أرقام
    const codeHash = await bcrypt.hash(code, 10);
    await this.prisma.otpCode.create({
      data: {
        userId: BigInt(userId),
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    const name = user.fullNameAr || user.fullName || '';
    const subject = 'رمز التحقّق - نظام الأرشفة الإلكترونية';
    const text =
      `مرحباً ${name}،\n\n` +
      `رمز التحقّق الخاص بك لاعتماد المعاملة هو: ${code}\n` +
      `الرمز صالح لمدة 10 دقائق. لا تشاركه مع أي شخص.\n\n` +
      `إن لم تطلب هذا الرمز، يرجى تجاهل الرسالة وإبلاغ مدير النظام.`;
    const html =
      `<div dir="rtl" style="font-family:sans-serif">` +
      `<p>مرحباً ${name}،</p>` +
      `<p>رمز التحقّق الخاص بك لاعتماد المعاملة هو:</p>` +
      `<p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>` +
      `<p>الرمز صالح لمدة 10 دقائق. لا تشاركه مع أي شخص.</p>` +
      `<p style="color:#888;font-size:12px">إن لم تطلب هذا الرمز فتجاهل الرسالة وأبلغ مدير النظام.</p>` +
      `</div>`;

    const delivered = await this.mail
      .send(user.email, subject, text, html)
      .catch((e) => {
        this.logger.error(`فشل إرسال بريد الرمز: ${e.message}`);
        throw new BadRequestException('تعذّر إرسال رمز التحقّق على البريد. حاول لاحقاً أو راجع مدير النظام.');
      });

    return {
      sentTo: this.maskEmail(user.email),
      delivered,
      expiresInSec: Math.floor(CODE_TTL_MS / 1000),
    };
  }

  /** يتحقّق من رمز أدخله المستخدم. يرمي عند انعدام/انتهاء الرمز، ويعيد ok=false عند عدم التطابق. */
  async verifyCode(userId: bigint | string, purpose: string, code: string): Promise<{ ok: boolean }> {
    const clean = (code || '').trim();
    if (!clean) throw new BadRequestException({ code: 'OTP_REQUIRED', message: 'أدخل رمز التحقّق' });

    const record = await this.prisma.otpCode.findFirst({
      where: { userId: BigInt(userId), purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new BadRequestException({ code: 'OTP_NOT_REQUESTED', message: 'لم يُطلب رمز تحقّق. اطلب رمزاً جديداً.' });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({ code: 'OTP_EXPIRED', message: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.' });
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException({ code: 'OTP_LOCKED', message: 'تجاوزت عدد المحاولات. اطلب رمزاً جديداً.' });
    }

    const match = await bcrypt.compare(clean, record.codeHash);
    if (!match) {
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return { ok: false };
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: true };
  }
}
