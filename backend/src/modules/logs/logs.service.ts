import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const AUDIT_ACTIONS = ['UPDATE', 'RESTORE', 'ATTACHMENT_ADDED', 'ATTACHMENT_DELETED'];
const ACCESS_ACTIONS = ['LOGIN_SUCCESS', 'LOGIN', 'LOGIN_FAILED', 'CORRESPONDENCE_VIEWED'];

export interface LogQuery {
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  /** قائمة موحّدة من جدول التدقيق حسب النوع (تعديلات / وصول). */
  async list(kind: 'audit' | 'access', q: LogQuery) {
    const base = kind === 'access' ? ACCESS_ACTIONS : AUDIT_ACTIONS;
    const actions = q.action && base.includes(q.action) ? [q.action] : base;

    const where: any = { action: { in: actions } };
    if (q.userId) where.userId = BigInt(q.userId);
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(q.from);
      if (q.to) where.createdAt.lte = new Date(q.to);
    }

    const take = Math.min(Number(q.take) || 50, 200);
    const skip = Number(q.skip) || 0;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: {
            select: {
              username: true,
              fullName: true,
              fullNameAr: true,
              department: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      total,
      skip,
      take,
      items: rows.map((r) => ({
        id: r.id.toString(),
        action: r.action,
        actorName: r.user?.fullNameAr || r.user?.fullName || r.user?.username || null,
        actorDepartment: r.user?.department?.name || null,
        entityType: r.entityType,
        entityId: r.entityId ? r.entityId.toString() : null,
        oldValues: r.oldValues,
        newValues: r.newValues,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        deviceMac: r.deviceMac,
        deviceHost: r.deviceHost,
        createdAt: r.createdAt,
      })),
    };
  }
}
