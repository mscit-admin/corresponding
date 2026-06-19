import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';

/** سياق الجهاز المرسَل مع الطلب (من الترويسات). */
export interface DeviceContext {
  ipAddress: string;
  userAgent?: string;
  deviceMac?: string;
  deviceHost?: string;
  deviceId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async login(dto: LoginDto, ipAddress: string, userAgent?: string, deviceMac?: string, deviceHost?: string, deviceId?: string): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: {
        role: true,
        department: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('الحساب معطل، يرجى التواصل مع مدير النظام');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      // Audit failed login attempt (fire-and-forget — don't delay the response)
      void this.prisma.auditLog
        .create({
          data: {
            userId: user.id,
            action: 'LOGIN_FAILED',
            entityType: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
            deviceMac: deviceMac || null,
            deviceHost: deviceHost || null,
            deviceId: deviceId || null,
          },
        })
        .catch((e) => this.logger.warn(`Audit (LOGIN_FAILED) failed: ${e.message}`));
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    // كلمة المرور صحيحة — تحقّق من أن الجهاز موثوق قبل إصدار الجلسة.
    // مدير النظام مُستثنى حتى يبقى قادراً على الدخول دائماً للموافقة على الآخرين.
    if (user.role.name !== 'super_admin') {
      await this.enforceTrustedDevice(user.id, user.fullName, {
        ipAddress,
        userAgent,
        deviceMac,
        deviceHost,
        deviceId,
      });
    }

    // Update last login + audit success in the background so the response is
    // not delayed by extra DB round-trips.
    void this.prisma.user
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch((e) => this.logger.warn(`lastLoginAt update failed: ${e.message}`));

    void this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: 'LOGIN_SUCCESS',
          entityType: 'User',
          entityId: user.id,
          ipAddress,
          userAgent,
          deviceMac: deviceMac || null,
          deviceHost: deviceHost || null,
          deviceId: deviceId || null,
        },
      })
      .catch((e) => this.logger.warn(`Audit (LOGIN_SUCCESS) failed: ${e.message}`));

    const accessToken = await this.jwt.signAsync({
      sub: user.id.toString(),
      username: user.username,
    });

    return {
      accessToken,
      user: {
        id: user.id.toString(),
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role.nameAr,
        roleName: user.role.name,
        department: user.department.name,
      },
    };
  }

  /**
   * يتحقّق أن الجهاز الحالي موثوق لهذا المستخدم. وإلا يرمي استثناءً بكود واضح
   * يستخدمه الواجهة لعرض الرسالة المناسبة:
   *  - DEVICE_PENDING: طلب سابق بانتظار موافقة المدير.
   *  - DEVICE_REJECTED: المدير رفض هذا الجهاز.
   *  - DEVICE_APPROVAL_REQUIRED: جهاز جديد — يجب على المستخدم إرسال سبب الدخول.
   * أول جهاز لكل مستخدم يُعتمد تلقائياً حتى لا يُقفل النظام بعد التفعيل.
   */
  private async enforceTrustedDevice(userId: bigint, fullName: string, ctx: DeviceContext): Promise<void> {
    const deviceId = (ctx.deviceId || '').trim();
    if (!deviceId) {
      throw new ForbiddenException({
        code: 'DEVICE_UNIDENTIFIED',
        message: 'تعذّر تحديد الجهاز. يرجى تحديث الصفحة والمحاولة مرة أخرى.',
      });
    }

    const existing = await this.prisma.trustedDevice.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });

    if (existing?.status === 'approved') {
      void this.prisma.trustedDevice
        .update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } })
        .catch((e) => this.logger.warn(`lastSeenAt update failed: ${e.message}`));
      return;
    }

    if (existing?.status === 'pending') {
      throw new ForbiddenException({
        code: 'DEVICE_PENDING',
        message: 'طلب الدخول من هذا الجهاز قيد المراجعة لدى مدير النظام. سيتم إشعارك عند الموافقة.',
      });
    }

    if (existing?.status === 'rejected') {
      throw new ForbiddenException({
        code: 'DEVICE_REJECTED',
        message: 'تم رفض الدخول من هذا الجهاز من قِبل مدير النظام. يرجى التواصل معه.',
      });
    }

    // لا يوجد سجل لهذا الجهاز — هل هو أول جهاز للمستخدم؟ إن كان كذلك نعتمده تلقائياً.
    const approvedCount = await this.prisma.trustedDevice.count({
      where: { userId, status: 'approved' },
    });
    if (approvedCount === 0) {
      await this.prisma.trustedDevice.create({
        data: {
          userId,
          deviceId,
          status: 'approved',
          label: 'الجهاز الأول (اعتماد تلقائي)',
          reason: 'أول جهاز للمستخدم — اعتُمد تلقائياً',
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent || null,
          deviceHost: ctx.deviceHost || null,
          deviceMac: ctx.deviceMac || null,
          decidedAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
      return;
    }

    // جهاز جديد بكلمة مرور صحيحة — نطلب من المستخدم إرسال سبب الدخول.
    throw new ForbiddenException({
      code: 'DEVICE_APPROVAL_REQUIRED',
      message: 'تم اكتشاف دخول من جهاز/متصفّح جديد. يرجى إدخال سبب الدخول لإرساله إلى مدير النظام للموافقة.',
      fullName,
    });
  }

  /**
   * يُنشئ طلب اعتماد جهاز جديد (بانتظار موافقة المدير) بعد إعادة التحقّق من
   * بيانات الدخول، ويُشعر مديري النظام باسم الموظف ورقمه الوظيفي وسبب الدخول.
   */
  async requestDeviceApproval(
    username: string,
    password: string,
    reason: string,
    ctx: DeviceContext,
  ): Promise<{ ok: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { role: true, department: true },
    });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    const deviceId = (ctx.deviceId || '').trim();
    if (!deviceId) {
      throw new BadRequestException('تعذّر تحديد الجهاز. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 5) {
      throw new BadRequestException('يرجى إدخال سبب واضح للدخول من جهاز جديد (5 أحرف على الأقل).');
    }

    const existing = await this.prisma.trustedDevice.findUnique({
      where: { userId_deviceId: { userId: user.id, deviceId } },
    });
    if (existing?.status === 'approved') {
      return { ok: true, message: 'هذا الجهاز معتمد بالفعل. يمكنك تسجيل الدخول.' };
    }

    const record = await this.prisma.trustedDevice.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId } },
      create: {
        userId: user.id,
        deviceId,
        status: 'pending',
        reason: cleanReason,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent || null,
        deviceHost: ctx.deviceHost || null,
        deviceMac: ctx.deviceMac || null,
      },
      update: {
        status: 'pending',
        reason: cleanReason,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent || null,
        deviceHost: ctx.deviceHost || null,
        deviceMac: ctx.deviceMac || null,
        decidedBy: null,
        decidedAt: null,
      },
    });

    // إشعار مديري النظام باسم الموظف ورقمه الوظيفي وسبب الدخول.
    const jobNo = user.username;
    await this.notifications
      .notifySuperAdmins({
        type: 'approval',
        title: `طلب اعتماد جهاز جديد — ${user.fullNameAr || user.fullName}`,
        body:
          `الموظف: ${user.fullNameAr || user.fullName}\n` +
          `الرقم الوظيفي: ${jobNo}\n` +
          `الإدارة: ${user.department?.name || '—'}\n` +
          `السبب: ${cleanReason}\n` +
          `عنوان IP: ${ctx.ipAddress}` +
          (ctx.deviceHost ? `\nالجهاز: ${ctx.deviceHost}` : ''),
        actionUrl: '/admin/device-approvals',
        relatedType: 'TrustedDevice',
        relatedId: record.id,
      })
      .catch((e) => this.logger.warn(`notify admins (device approval) failed: ${e.message}`));

    void this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: 'DEVICE_APPROVAL_REQUESTED',
          entityType: 'TrustedDevice',
          entityId: record.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent || null,
          deviceMac: ctx.deviceMac || null,
          deviceHost: ctx.deviceHost || null,
          deviceId,
          newValues: { reason: cleanReason },
        },
      })
      .catch((e) => this.logger.warn(`Audit (DEVICE_APPROVAL_REQUESTED) failed: ${e.message}`));

    return {
      ok: true,
      message: 'تم إرسال طلبك إلى مدير النظام. سيتم إشعارك عند الموافقة على الجهاز.',
    };
  }

  /** قائمة طلبات/أجهزة الاعتماد (لمدير النظام). */
  async listDeviceApprovals(status?: string) {
    const where: any = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }
    const rows = await this.prisma.trustedDevice.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            fullNameAr: true,
            department: { select: { name: true } },
          },
        },
        decider: { select: { username: true, fullName: true, fullNameAr: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      status: r.status,
      reason: r.reason,
      label: r.label,
      deviceId: r.deviceId,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      deviceHost: r.deviceHost,
      deviceMac: r.deviceMac,
      employeeName: r.user?.fullNameAr || r.user?.fullName || r.user?.username || null,
      jobNo: r.user?.username || null,
      department: r.user?.department?.name || null,
      decidedBy: r.decider?.fullNameAr || r.decider?.fullName || r.decider?.username || null,
      decidedAt: r.decidedAt,
      lastSeenAt: r.lastSeenAt,
      createdAt: r.createdAt,
    }));
  }

  /** موافقة/رفض جهاز من قِبل مدير النظام، مع إشعار المستخدم بالنتيجة. */
  async decideDevice(
    id: string,
    deciderId: bigint,
    approve: boolean,
    ctx: DeviceContext,
  ): Promise<{ ok: boolean }> {
    const record = await this.prisma.trustedDevice.findUnique({
      where: { id: BigInt(id) },
      include: { user: { select: { id: true, fullName: true, fullNameAr: true } } },
    });
    if (!record) {
      throw new NotFoundException('طلب الجهاز غير موجود');
    }

    await this.prisma.trustedDevice.update({
      where: { id: record.id },
      data: {
        status: approve ? 'approved' : 'rejected',
        decidedBy: deciderId,
        decidedAt: new Date(),
      },
    });

    await this.notifications
      .notifyMany([record.userId], {
        type: 'system',
        title: approve ? 'تمت الموافقة على جهازك الجديد' : 'تم رفض جهازك الجديد',
        body: approve
          ? 'وافق مدير النظام على دخولك من الجهاز الجديد. يمكنك الآن تسجيل الدخول.'
          : 'رفض مدير النظام الدخول من الجهاز الجديد. يرجى التواصل مع مدير النظام.',
        actionUrl: '/login',
        relatedType: 'TrustedDevice',
        relatedId: record.id,
      })
      .catch((e) => this.logger.warn(`notify user (device decision) failed: ${e.message}`));

    void this.prisma.auditLog
      .create({
        data: {
          userId: deciderId,
          action: approve ? 'DEVICE_APPROVED' : 'DEVICE_REJECTED',
          entityType: 'TrustedDevice',
          entityId: record.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent || null,
          deviceMac: ctx.deviceMac || null,
          deviceHost: ctx.deviceHost || null,
          deviceId: ctx.deviceId || null,
        },
      })
      .catch((e) => this.logger.warn(`Audit (DEVICE decision) failed: ${e.message}`));

    return { ok: true };
  }

  async hashPassword(password: string): Promise<string> {
    const rounds = this.config.get<number>('security.bcryptRounds') || 12;
    return bcrypt.hash(password, rounds);
  }
}
