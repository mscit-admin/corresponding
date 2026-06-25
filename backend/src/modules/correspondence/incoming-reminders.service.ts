import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// الحالات التي تُعدّ المعاملة فيها منتهية فلا تُذكَّر بالتأخير/المهلة
const COMPLETED_STATUSES = ['approved', 'responded', 'closed', 'archived', 'rejected'];
// نافذة «قرب انتهاء المهلة»: المعاملات المستحقّة خلال الساعات القادمة
const APPROACHING_HOURS = 48;

/**
 * مجدول تنبيهات المُهَل: يفحص يومياً المعاملات الواردة غير المنجزة التي لها
 * تاريخ استحقاق (dueDate) ويرسل تنبيهين:
 *   - «قرب انتهاء المهلة» للمعاملات المستحقّة خلال APPROACHING_HOURS القادمة.
 *   - «تأخير المعاملة» للمعاملات التي تجاوزت تاريخ استحقاقها.
 * المستلمون: المالك الحالي ومُنشئ المعاملة (وأي منهما غير مكرّر).
 * ملاحظة: التنبيه يتكرّر يومياً حتى تُنجَز المعاملة أو يُحدَّث تاريخ استحقاقها.
 */
@Injectable()
export class IncomingRemindersService {
  private readonly logger = new Logger(IncomingRemindersService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // كل يوم الساعة 7:00 صباحاً بتوقيت الخادم
  @Cron(CronExpression.EVERY_DAY_AT_7AM, { name: 'incoming-due-reminders' })
  async sendDueReminders() {
    const now = new Date();
    const soon = new Date(now.getTime() + APPROACHING_HOURS * 36e5);

    try {
      // المعاملات غير المنجزة التي لها مهلة محدّدة
      const items = await this.prisma.incomingCorrespondence.findMany({
        where: {
          dueDate: { not: null },
          status: { notIn: COMPLETED_STATUSES as any },
        },
        select: {
          id: true, serialNo: true, subject: true, dueDate: true,
          currentOwnerId: true, createdBy: true,
        },
      });

      let approaching = 0;
      let overdue = 0;

      for (const it of items) {
        if (!it.dueDate) continue;
        const recipients = [it.currentOwnerId, it.createdBy];
        const base = {
          actionUrl: `/inbox/${it.id}`,
          relatedType: 'incoming',
          relatedId: it.id,
        };

        if (it.dueDate < now) {
          // تأخير: تجاوزت تاريخ الاستحقاق
          const daysLate = Math.floor((now.getTime() - it.dueDate.getTime()) / 864e5);
          await this.notifications.notifyMany(recipients, {
            type: 'reminder',
            title: 'تأخير في إنجاز معاملة واردة',
            body: `${it.serialNo} — ${it.subject} (متأخرة ${daysLate} يوم عن المهلة)`,
            ...base,
          });
          overdue++;
        } else if (it.dueDate <= soon) {
          // قرب انتهاء المهلة
          const hoursLeft = Math.max(1, Math.round((it.dueDate.getTime() - now.getTime()) / 36e5));
          await this.notifications.notifyMany(recipients, {
            type: 'reminder',
            title: 'اقتراب انتهاء مهلة معاملة واردة',
            body: `${it.serialNo} — ${it.subject} (يتبقّى نحو ${hoursLeft} ساعة)`,
            ...base,
          });
          approaching++;
        }
      }

      this.logger.log(
        `Due reminders: ${approaching} approaching, ${overdue} overdue (scanned ${items.length}).`,
      );
    } catch (e: any) {
      this.logger.error(`Due reminders job failed: ${e.message}`);
    }
  }
}
