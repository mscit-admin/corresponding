import { Injectable, Logger } from '@nestjs/common';
import { join, basename, extname } from 'path';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const execFileP = promisify(execFile);

const OFFICE_MIME = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const serializeBigInt = (obj: any) =>
  JSON.parse(JSON.stringify(obj, (k, v) => (typeof v === 'bigint' ? v.toString() : v)));

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly UPLOADS = join(process.cwd(), 'uploads');
  private readonly CACHE = join(process.cwd(), 'uploads', 'cache');

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private actionUrlFor(type: string, id: string | bigint) {
    return type === 'outgoing' ? `/outgoing/${id}` : `/inbox/${id}`;
  }

  async save(params: {
    correspondenceType: string;
    correspondenceId: string;
    file: Express.Multer.File;
    userId: any;
    ip?: string;
    userAgent?: string;
    deviceMac?: string;
    deviceHost?: string;
    deviceId?: string;
  }) {
    const { correspondenceType, correspondenceId, file, userId, ip, userAgent, deviceMac, deviceHost, deviceId } = params;
    this.logger.log(
      `Saving attachment: ${file.originalname} for ${correspondenceType}#${correspondenceId}`,
    );

    const userIdBig = BigInt(userId);
    const correspondenceIdBig = BigInt(correspondenceId);

    // Insert via raw SQL since this model isn't in Prisma schema
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO attachments 
        (correspondence_type, correspondence_id, file_name, original_name, file_path, mime_type, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      correspondenceType,
      correspondenceIdBig,
      file.filename,
      file.originalname,
      file.path,
      file.mimetype,
      BigInt(file.size),
      userIdBig,
    );

    // Get the inserted row
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, file_name as fileName, original_name as originalName, 
              file_path as filePath, mime_type as mimeType, file_size as fileSize,
              uploaded_at as uploadedAt
       FROM attachments 
       WHERE correspondence_type = ? AND correspondence_id = ? AND file_name = ?
       ORDER BY id DESC LIMIT 1`,
      correspondenceType,
      correspondenceIdBig,
      file.filename,
    );

    const result = rows[0] || null;
    this.logger.log(`✓ Saved attachment id: ${result?.id}`);

    // سجلّ التدقيق: من أضاف المستند ومتى وبأي تفاصيل
    await this.writeAudit({
      userId: userIdBig,
      action: 'ATTACHMENT_ADDED',
      entityType: correspondenceType,
      entityId: correspondenceIdBig,
      newValues: { originalName: file.originalname, fileSize: file.size, mimeType: file.mimetype },
      ip,
      userAgent,
      deviceMac,
      deviceHost,
      deviceId,
    });

    // تنبيه مديري النظام بإضافة مستند (مع رابط لمكان الحدث)
    void this.notifications.notifySuperAdmins(
      {
        type: 'system',
        title: 'إضافة مرفق',
        body: `تمت إضافة المستند: ${file.originalname}`,
        actionUrl: this.actionUrlFor(correspondenceType, correspondenceId),
        relatedType: correspondenceType,
        relatedId: correspondenceIdBig,
      },
      userIdBig,
    );

    return serializeBigInt(result);
  }

  /** يكتب سطراً في سجلّ التدقيق (fire-and-forget). */
  private async writeAudit(p: {
    userId: bigint;
    action: string;
    entityType: string;
    entityId: bigint;
    oldValues?: any;
    newValues?: any;
    ip?: string;
    userAgent?: string;
    deviceMac?: string;
    deviceHost?: string;
    deviceId?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: p.userId,
          action: p.action,
          entityType: p.entityType,
          entityId: p.entityId,
          oldValues: p.oldValues ?? undefined,
          newValues: p.newValues ?? undefined,
          ipAddress: p.ip || '0.0.0.0',
          userAgent: p.userAgent || null,
          deviceMac: p.deviceMac || null,
          deviceHost: p.deviceHost || null,
          deviceId: p.deviceId || null,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Audit write failed (${p.action}): ${e.message}`);
    }
  }

  async findById(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, file_name as fileName, original_name as originalName,
              file_path as filePath, mime_type as mimeType, file_size as fileSize,
              correspondence_type as correspondenceType, correspondence_id as correspondenceId
       FROM attachments WHERE id = ?`,
      BigInt(id),
    );
    if (!rows || rows.length === 0) return null;
    return serializeBigInt(rows[0]);
  }

  /**
   * يسجّل فتح/مشاهدة مرفق من قِبل مستخدم (بما فيهم المُدخِل).
   * يُستدعى عند تحميل/عرض المستند. لا يُفشل الطلب لو فشل التسجيل.
   */
  async recordView(attachmentId: string, userId: any) {
    if (!userId) return;
    try {
      const attachmentIdBig = BigInt(attachmentId);
      const userIdBig = BigInt(userId);
      await this.prisma.attachmentView.upsert({
        where: { attachmentId_userId: { attachmentId: attachmentIdBig, userId: userIdBig } },
        update: { lastViewedAt: new Date(), viewCount: { increment: 1 } },
        create: { attachmentId: attachmentIdBig, userId: userIdBig },
      });
    } catch (e) {
      this.logger.warn(`Could not record attachment view: ${e.message}`);
    }
  }

  /**
   * سجلّ "من فتح هذا المستند ومتى" — للمراقبة (الأدمن الرئيسي فقط).
   */
  async getViews(attachmentId: string) {
    const views = await this.prisma.attachmentView.findMany({
      where: { attachmentId: BigInt(attachmentId) },
      orderBy: { lastViewedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            fullNameAr: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    return views.map((v) => ({
      userId: v.userId.toString(),
      fullName: v.user.fullNameAr || v.user.fullName,
      department: v.user.department?.name || null,
      firstViewedAt: v.firstViewedAt,
      lastViewedAt: v.lastViewedAt,
      viewCount: v.viewCount,
    }));
  }

  /**
   * يُعيد ملفاً قابلاً للمعاينة داخل النظام:
   * - PDF/صورة: الملف الأصلي كما هو.
   * - Word/Excel: يُحوّل إلى PDF (مرّة واحدة ويُخزَّن مؤقتاً) ثم يُعاد.
   * يُعيد null إن لم يكن النوع قابلاً للمعاينة أو الملف مفقود.
   */
  async getPreviewFile(
    id: string,
  ): Promise<{ path: string; mimeType: string; originalName: string } | null> {
    const att = await this.findById(id);
    if (!att) return null;

    const src = join(this.UPLOADS, att.fileName);
    if (!existsSync(src)) return null;

    if (att.mimeType === 'application/pdf' || att.mimeType?.startsWith('image/')) {
      return { path: src, mimeType: att.mimeType, originalName: att.originalName };
    }

    if (OFFICE_MIME.has(att.mimeType)) {
      if (!existsSync(this.CACHE)) mkdirSync(this.CACHE, { recursive: true });
      const base = basename(att.fileName, extname(att.fileName));
      const outPdf = join(this.CACHE, `${base}.pdf`);
      if (!existsSync(outPdf)) {
        await this.convertToPdf(src, this.CACHE);
        if (!existsSync(outPdf)) throw new Error('PDF conversion produced no output');
      }
      const pdfName = att.originalName.replace(/\.[^.]+$/, '') + '.pdf';
      return { path: outPdf, mimeType: 'application/pdf', originalName: pdfName };
    }

    return null; // نوع غير قابل للمعاينة
  }

  /** يحوّل ملف Office إلى PDF عبر LibreOffice headless (ملف مخرَج: نفس الاسم بامتداد pdf). */
  private async convertToPdf(inputPath: string, outDir: string): Promise<void> {
    const profile = `file:///tmp/lo_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    this.logger.log(`Converting to PDF via LibreOffice: ${inputPath}`);
    await execFileP(
      'soffice',
      [
        '--headless', '--norestore', '--nolockcheck',
        `-env:UserInstallation=${profile}`,
        '--convert-to', 'pdf', '--outdir', outDir, inputPath,
      ],
      { timeout: 90_000, env: { ...process.env, HOME: '/tmp' } },
    );
  }

  async remove(id: string, userId?: any, ip?: string, userAgent?: string, deviceMac?: string, deviceHost?: string, deviceId?: string): Promise<boolean> {
    const attachment = await this.findById(id);
    if (!attachment) return false;

    // delete the DB row
    await this.prisma.$executeRawUnsafe(`DELETE FROM attachments WHERE id = ?`, BigInt(id));

    // سجلّ التدقيق: من حذف المستند
    if (userId && attachment.correspondenceId) {
      await this.writeAudit({
        userId: BigInt(userId),
        action: 'ATTACHMENT_DELETED',
        entityType: String(attachment.correspondenceType || 'incoming'),
        entityId: BigInt(attachment.correspondenceId),
        oldValues: { originalName: attachment.originalName },
        ip,
        userAgent,
        deviceMac,
        deviceHost,
        deviceId,
      });

      // تنبيه مديري النظام بحذف مستند
      void this.notifications.notifySuperAdmins(
        {
          type: 'system',
          title: 'حذف مرفق',
          body: `تم حذف المستند: ${attachment.originalName}`,
          actionUrl: this.actionUrlFor(String(attachment.correspondenceType || 'incoming'), attachment.correspondenceId),
          relatedType: String(attachment.correspondenceType || 'incoming'),
          relatedId: BigInt(attachment.correspondenceId),
        },
        userId,
      );
    }

    // best-effort delete of the file on disk (and any cached PDF preview)
    try {
      const filePath = join(this.UPLOADS, attachment.fileName);
      if (existsSync(filePath)) unlinkSync(filePath);
      const cachedPdf = join(this.CACHE, `${basename(attachment.fileName, extname(attachment.fileName))}.pdf`);
      if (existsSync(cachedPdf)) unlinkSync(cachedPdf);
    } catch (e) {
      this.logger.warn(`Could not delete file for attachment ${id}: ${e.message}`);
    }

    this.logger.log(`✓ Deleted attachment id: ${id}`);
    return true;
  }
}
