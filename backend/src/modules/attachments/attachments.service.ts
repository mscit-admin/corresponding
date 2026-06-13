import { Injectable, Logger } from '@nestjs/common';
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
}
