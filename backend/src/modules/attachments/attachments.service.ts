import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';

const serializeBigInt = (obj: any) =>
  JSON.parse(JSON.stringify(obj, (k, v) => (typeof v === 'bigint' ? v.toString() : v)));

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(private prisma: PrismaService) {}

  async save(params: {
    correspondenceType: string;
    correspondenceId: string;
    file: Express.Multer.File;
    userId: any;
  }) {
    const { correspondenceType, correspondenceId, file, userId } = params;
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

    return serializeBigInt(result);
  }

  async findById(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, file_name as fileName, original_name as originalName,
              file_path as filePath, mime_type as mimeType, file_size as fileSize
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

  async remove(id: string): Promise<boolean> {
    const attachment = await this.findById(id);
    if (!attachment) return false;

    // delete the DB row
    await this.prisma.$executeRawUnsafe(`DELETE FROM attachments WHERE id = ?`, BigInt(id));

    // best-effort delete of the file on disk
    try {
      const uploadsDir = join(process.cwd(), 'uploads');
      const filePath = join(uploadsDir, attachment.fileName);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch (e) {
      this.logger.warn(`Could not delete file for attachment ${id}: ${e.message}`);
    }

    this.logger.log(`✓ Deleted attachment id: ${id}`);
    return true;
  }
}
