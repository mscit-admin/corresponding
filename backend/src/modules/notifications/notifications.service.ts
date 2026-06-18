import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type NotifType = 'transfer' | 'approval' | 'reminder' | 'system' | 'mention';

export interface NotifyInput {
  type: NotifType;
  title: string;
  body?: string;
  actionUrl?: string;
  relatedType?: string;
  relatedId?: bigint | string | number;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /** ينشئ تنبيهاً لكل مستخدم في القائمة (يتجاهل القيم الفارغة والمكرّرة). */
  async notifyMany(userIds: (bigint | string | number | null | undefined)[], input: NotifyInput) {
    const ids = [
      ...new Set(
        userIds.filter((u) => u != null).map((u) => BigInt(u as any).toString()),
      ),
    ];
    if (!ids.length) return;
    await this.prisma.notification.createMany({
      data: ids.map((uid) => ({
        userId: BigInt(uid),
        type: input.type as any,
        title: input.title,
        body: input.body ?? null,
        actionUrl: input.actionUrl ?? null,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId != null ? BigInt(input.relatedId as any) : null,
      })),
    });
  }

  /** ينبّه كل مديري النظام (super_admin) بحدث، مع استثناء منفّذ الحدث. */
  async notifySuperAdmins(input: NotifyInput, exceptUserId?: bigint | string | number | null) {
    const admins = await this.prisma.user.findMany({
      where: { isActive: true, role: { name: 'super_admin' } },
      select: { id: true },
    });
    const except = exceptUserId != null ? BigInt(exceptUserId as any).toString() : null;
    const ids = admins.map((a) => a.id).filter((id) => id.toString() !== except);
    await this.notifyMany(ids, input);
  }

  async list(userId: bigint | string, opts: { unreadOnly?: boolean; take?: number } = {}) {
    const where: any = { userId: BigInt(userId) };
    if (opts.unreadOnly) where.isRead = false;
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.take ?? 30, 100),
    });
    return rows.map((n) => ({
      ...n,
      id: n.id.toString(),
      userId: n.userId.toString(),
      relatedId: n.relatedId?.toString() ?? null,
    }));
  }

  async unreadCount(userId: bigint | string) {
    const count = await this.prisma.notification.count({
      where: { userId: BigInt(userId), isRead: false },
    });
    return { count };
  }

  async markRead(id: bigint | string, userId: bigint | string) {
    await this.prisma.notification.updateMany({
      where: { id: BigInt(id), userId: BigInt(userId) },
      data: { isRead: true, readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: bigint | string) {
    await this.prisma.notification.updateMany({
      where: { userId: BigInt(userId), isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { ok: true };
  }
}
