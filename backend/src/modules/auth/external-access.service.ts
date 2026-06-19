import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessService } from '../access/access.service';
import { OtpService } from '../otp/otp.service';
import { DeviceContext } from './auth.service';

const OTP_PURPOSE = 'external_login';

/** يطبّع الاسم للمقارنة (إزالة المسافات الزائدة وتوحيدها). */
function normalizeName(s: string): string {
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * إدارة الدخول من خارج شبكة المؤسسة:
 *  - يتطلّب موافقة مدير النظام لكل جهاز/متصفّح على حدة.
 *  - الموافقة بمدة محدّدة أو مفتوحة، ويمكن قفل المستخدم نهائياً من الدخول الخارجي.
 */
@Injectable()
export class ExternalAccessService {
  private readonly logger = new Logger(ExternalAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly access: AccessService,
    private readonly otp: OtpService,
  ) {}

  /** هل عنوان الـIP ضمن شبكة المؤسسة؟ */
  async isCompanyIp(ip: string): Promise<boolean> {
    const cfg = await this.access.getConfig();
    return this.access.isCompanyIp(ip, cfg.companyCidrs);
  }

  /** هل لدى المستخدم تصريح دخول خارجي ساري لهذا الجهاز؟ */
  async hasActiveGrant(userId: bigint, deviceId: string): Promise<boolean> {
    if (!deviceId) return false;
    const grant = await this.prisma.externalAccessRequest.findFirst({
      where: { userId, deviceId, status: 'approved' },
      orderBy: { decidedAt: 'desc' },
    });
    if (!grant) return false;
    if (grant.grantType === 'open') return true;
    return !!grant.grantUntil && grant.grantUntil.getTime() > Date.now();
  }

  /**
   * يُطبَّق عند الدخول من جهاز خارجي. يرمي استثناءً بكود مناسب للواجهة:
   *  EXTERNAL_LOCKED / EXTERNAL_PENDING / EXTERNAL_DENIED / EXTERNAL_APPROVAL_REQUIRED
   */
  async enforceAtLogin(
    user: { id: bigint; externalLoginLocked: boolean; fullName: string; fullNameAr?: string | null },
    ctx: DeviceContext,
  ): Promise<void> {
    if (user.externalLoginLocked) {
      throw new ForbiddenException({
        code: 'EXTERNAL_LOCKED',
        message: 'تم إيقاف الدخول الخارجي لحسابك من قِبل مدير النظام. يرجى التواصل معه.',
      });
    }

    const deviceId = (ctx.deviceId || '').trim();
    if (!deviceId) {
      throw new ForbiddenException({
        code: 'DEVICE_UNIDENTIFIED',
        message: 'تعذّر تحديد الجهاز. يرجى تحديث الصفحة والمحاولة مرة أخرى.',
      });
    }

    const req = await this.prisma.externalAccessRequest.findFirst({
      where: { userId: user.id, deviceId },
      orderBy: { createdAt: 'desc' },
    });

    if (req?.status === 'approved') {
      const valid = req.grantType === 'open' || (!!req.grantUntil && req.grantUntil.getTime() > Date.now());
      if (valid) {
        void this.prisma.externalAccessRequest
          .update({ where: { id: req.id }, data: { lastSeenAt: new Date() } })
          .catch((e) => this.logger.warn(`lastSeen update failed: ${e.message}`));
        return; // مسموح
      }
      // انتهت صلاحية التصريح — علّمه منتهياً واطلب طلباً جديداً
      void this.prisma.externalAccessRequest
        .update({ where: { id: req.id }, data: { status: 'expired' } })
        .catch(() => undefined);
      throw new ForbiddenException({
        code: 'EXTERNAL_APPROVAL_REQUIRED',
        message: 'انتهت صلاحية تصريح الدخول الخارجي لهذا الجهاز. يرجى تقديم طلب جديد.',
        fullName: user.fullNameAr || user.fullName,
      });
    }

    if (req?.status === 'pending') {
      throw new ForbiddenException({
        code: 'EXTERNAL_PENDING',
        message: 'طلب دخولك الخارجي قيد المراجعة لدى مدير النظام. سيتم إشعارك عند الموافقة.',
      });
    }

    if (req?.status === 'denied') {
      throw new ForbiddenException({
        code: 'EXTERNAL_DENIED',
        message: 'تم رفض طلب دخولك الخارجي من قِبل مدير النظام. يمكنك تقديم طلب جديد أو التواصل معه.',
      });
    }

    throw new ForbiddenException({
      code: 'EXTERNAL_APPROVAL_REQUIRED',
      message: 'الدخول من خارج شبكة المؤسسة يتطلّب موافقة مدير النظام. يرجى استكمال النموذج.',
      fullName: user.fullNameAr || user.fullName,
    });
  }

  /** يتحقّق من بيانات الدخول ويُرجع المستخدم، أو يرمي 401. */
  private async authenticate(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { role: true, department: true },
    });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    return user;
  }

  /** إرسال رمز التحقّق إلى بريد المستخدم (بعد التحقّق من بيانات الدخول). */
  async requestCode(username: string, password: string) {
    const user = await this.authenticate(username, password);
    if (user.externalLoginLocked) {
      throw new ForbiddenException({
        code: 'EXTERNAL_LOCKED',
        message: 'تم إيقاف الدخول الخارجي لحسابك من قِبل مدير النظام.',
      });
    }
    return this.otp.requestCode(user.id, OTP_PURPOSE);
  }

  /** تقديم طلب دخول خارجي بعد التحقّق من: بيانات الدخول + الاسم الثلاثي + رمز البريد. */
  async submitRequest(
    username: string,
    password: string,
    fullName: string,
    otpCode: string,
    ctx: DeviceContext,
  ): Promise<{ ok: boolean; message: string }> {
    const user = await this.authenticate(username, password);
    if (user.externalLoginLocked) {
      throw new ForbiddenException({
        code: 'EXTERNAL_LOCKED',
        message: 'تم إيقاف الدخول الخارجي لحسابك من قِبل مدير النظام.',
      });
    }

    const deviceId = (ctx.deviceId || '').trim();
    if (!deviceId) {
      throw new BadRequestException('تعذّر تحديد الجهاز. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
    }

    // مطابقة الاسم الثلاثي مع المسجّل (عربي أو إنجليزي)
    const provided = normalizeName(fullName);
    const matchesName =
      provided.length > 0 &&
      (provided === normalizeName(user.fullName) || provided === normalizeName(user.fullNameAr || ''));
    if (!matchesName) {
      throw new BadRequestException('الاسم الثلاثي غير مطابق للمسجّل في النظام.');
    }

    // التحقّق من رمز البريد
    const res = await this.otp.verifyCode(user.id, OTP_PURPOSE, otpCode);
    if (!res.ok) {
      throw new BadRequestException({ code: 'OTP_MISMATCH', message: 'رمز التحقّق غير صحيح.' });
    }

    // أنشئ/حدّث طلباً معلّقاً لهذا الجهاز
    const existing = await this.prisma.externalAccessRequest.findFirst({
      where: { userId: user.id, deviceId, status: 'pending' },
    });
    const data = {
      status: 'pending',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent || null,
      deviceHost: ctx.deviceHost || null,
      deviceMac: ctx.deviceMac || null,
      grantType: null,
      grantUntil: null,
      decidedById: null,
      decidedAt: null,
    };
    const record = existing
      ? await this.prisma.externalAccessRequest.update({ where: { id: existing.id }, data })
      : await this.prisma.externalAccessRequest.create({
          data: { userId: user.id, deviceId, ...data },
        });

    await this.notifications
      .notifySuperAdmins({
        type: 'approval',
        title: `طلب دخول خارجي — ${user.fullNameAr || user.fullName}`,
        body:
          `الموظف: ${user.fullNameAr || user.fullName}\n` +
          `الرقم الوظيفي: ${user.username}\n` +
          `الإدارة: ${user.department?.name || '—'}\n` +
          `عنوان IP: ${ctx.ipAddress}` +
          (ctx.deviceHost ? `\nالجهاز: ${ctx.deviceHost}` : ''),
        actionUrl: '/admin/external-requests',
        relatedType: 'ExternalAccessRequest',
        relatedId: record.id,
      })
      .catch((e) => this.logger.warn(`notify admins (external request) failed: ${e.message}`));

    void this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: 'EXTERNAL_ACCESS_REQUESTED',
          entityType: 'ExternalAccessRequest',
          entityId: record.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent || null,
          deviceMac: ctx.deviceMac || null,
          deviceHost: ctx.deviceHost || null,
          deviceId,
        },
      })
      .catch((e) => this.logger.warn(`Audit (EXTERNAL_ACCESS_REQUESTED) failed: ${e.message}`));

    return {
      ok: true,
      message: 'تم إرسال طلب الدخول الخارجي إلى مدير النظام. سيتم إشعارك عند الموافقة.',
    };
  }

  /** قائمة طلبات الدخول الخارجي (لمدير النظام). */
  async list(status?: string) {
    const where: any = {};
    if (status && ['pending', 'approved', 'denied', 'expired'].includes(status)) {
      where.status = status;
    }
    const rows = await this.prisma.externalAccessRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            fullNameAr: true,
            externalLoginLocked: true,
            department: { select: { name: true } },
          },
        },
        decider: { select: { username: true, fullName: true, fullNameAr: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      status: r.status,
      userId: r.user?.id.toString() || null,
      employeeName: r.user?.fullNameAr || r.user?.fullName || r.user?.username || null,
      jobNo: r.user?.username || null,
      department: r.user?.department?.name || null,
      externalLocked: r.user?.externalLoginLocked || false,
      deviceId: r.deviceId,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      deviceHost: r.deviceHost,
      deviceMac: r.deviceMac,
      grantType: r.grantType,
      grantUntil: r.grantUntil,
      decidedBy: r.decider?.fullNameAr || r.decider?.fullName || r.decider?.username || null,
      decidedAt: r.decidedAt,
      lastSeenAt: r.lastSeenAt,
      createdAt: r.createdAt,
    }));
  }

  /** الموافقة على طلب دخول خارجي بمدة محدّدة (hours) أو مفتوحة. */
  async approve(id: string, deciderId: bigint, opts: { hours?: number }): Promise<{ ok: boolean }> {
    const req = await this.prisma.externalAccessRequest.findUnique({ where: { id: BigInt(id) } });
    if (!req) throw new NotFoundException('الطلب غير موجود');

    const hours = opts.hours;
    const isOpen = !hours || hours <= 0;
    await this.prisma.externalAccessRequest.update({
      where: { id: req.id },
      data: {
        status: 'approved',
        grantType: isOpen ? 'open' : 'until',
        grantUntil: isOpen ? null : new Date(Date.now() + hours * 3600_000),
        decidedById: deciderId,
        decidedAt: new Date(),
      },
    });

    await this.notifications
      .notifyMany([req.userId], {
        type: 'approval',
        title: 'تمت الموافقة على دخولك الخارجي',
        body: isOpen
          ? 'وافق مدير النظام على دخولك من هذا الجهاز (صلاحية مفتوحة). يمكنك تسجيل الدخول الآن.'
          : `وافق مدير النظام على دخولك من هذا الجهاز لمدة ${hours} ساعة. يمكنك تسجيل الدخول الآن.`,
        actionUrl: '/login',
      })
      .catch((e) => this.logger.warn(`notify user (external approved) failed: ${e.message}`));

    return { ok: true };
  }

  /** رفض طلب دخول خارجي. */
  async deny(id: string, deciderId: bigint): Promise<{ ok: boolean }> {
    const req = await this.prisma.externalAccessRequest.findUnique({ where: { id: BigInt(id) } });
    if (!req) throw new NotFoundException('الطلب غير موجود');
    await this.prisma.externalAccessRequest.update({
      where: { id: req.id },
      data: { status: 'denied', decidedById: deciderId, decidedAt: new Date() },
    });
    await this.notifications
      .notifyMany([req.userId], {
        type: 'approval',
        title: 'تم رفض دخولك الخارجي',
        body: 'رفض مدير النظام طلب دخولك من هذا الجهاز. يمكنك التواصل معه لمزيد من التفاصيل.',
      })
      .catch(() => undefined);
    return { ok: true };
  }

  /** قفل/فتح الدخول الخارجي لمستخدم نهائياً، مع إبطال تصاريحه السارية عند القفل. */
  async setLock(userId: string, locked: boolean): Promise<{ ok: boolean }> {
    const uid = BigInt(userId);
    await this.prisma.user.update({ where: { id: uid }, data: { externalLoginLocked: locked } });
    if (locked) {
      await this.prisma.externalAccessRequest.updateMany({
        where: { userId: uid, status: 'approved' },
        data: { status: 'expired' },
      });
    }
    return { ok: true };
  }
}
