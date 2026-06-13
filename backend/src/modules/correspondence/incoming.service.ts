import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// BigInt JSON serializer helper
const serializeBigInt = (obj: any) => 
  JSON.parse(JSON.stringify(obj, (k, v) => typeof v === 'bigint' ? v.toString() : v));

@Injectable()
export class IncomingService {
  private readonly logger = new Logger(IncomingService.name);
  
  constructor(private prisma: PrismaService) {}

  async create(data: any, userId: any, ip?: any) {
    this.logger.log(`Creating incoming - userId: ${userId}`);
    
    try {
      const userIdBig = BigInt(userId);
      const senderEntityIdBig = BigInt(data.senderEntityId);

      // Generate serial number
      const year = new Date().getFullYear();
      const lastSerial = await this.prisma.incomingCorrespondence.findFirst({
        where: { serialNo: { startsWith: `IN-${year}-` } },
        orderBy: { serialNo: 'desc' },
        select: { serialNo: true },
      });

      let nextNumber = 1;
      if (lastSerial) {
        const parts = lastSerial.serialNo.split('-');
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }
      const serialNo = `IN-${year}-${String(nextNumber).padStart(5, '0')}`;

      // Build create data with recipient fields
      const createData: any = {
        serialNo,
        receivedAt: new Date(data.receivedAt),
        senderEntityId: senderEntityIdBig,
        senderRefNo: data.senderRefNo || null,
        subject: data.subject,
        priority: data.priority || 'normal',
        status: 'new',
        createdBy: userIdBig,
        currentOwnerId: userIdBig,
      };

      // Add recipient fields if provided
      if (data.recipientType) {
        createData.recipientType = data.recipientType;
      }
      if (data.recipientName) {
        createData.recipientName = data.recipientName;
      }

      const correspondence = await this.prisma.incomingCorrespondence.create({
        data: createData,
        include: { senderEntity: true },
      });

      this.logger.log(`✓ Created correspondence id: ${correspondence.id}, serial: ${serialNo}`);
      
      return serializeBigInt(correspondence);
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      this.logger.error(`Code: ${error.code || 'N/A'}, Stack: ${error.stack}`);
      
      if (error.code === 'P2003') {
        throw new BadRequestException('الجهة المرسلة غير موجودة في قاعدة البيانات');
      }
      if (error.code === 'P2002') {
        throw new BadRequestException('رقم المراسلة مكرر');
      }
      throw new BadRequestException(`خطأ في حفظ المراسلة: ${error.message}`);
    }
  }

  async findAll(params: any, userId?: any) {
    const { skip = 0, take = 20, status, search } = params || {};
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { serialNo: { contains: search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.incomingCorrespondence.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: { receivedAt: 'desc' },
        include: { senderEntity: true },
      }),
      this.prisma.incomingCorrespondence.count({ where }),
    ]);
    
    // Get attachment counts for all items
    const ids = data.map(d => d.id);
    const attachmentCounts = ids.length > 0 ? await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT correspondence_id as id, COUNT(*) as count 
       FROM attachments 
       WHERE correspondence_type = 'incoming' AND correspondence_id IN (${ids.join(',')})
       GROUP BY correspondence_id`
    ) : [];
    
    const countMap = new Map(attachmentCounts.map((a: any) => [a.id.toString(), Number(a.count)]));
    const dataWithCounts = data.map((d: any) => ({
      ...d,
      attachmentCount: countMap.get(d.id.toString()) || 0,
    }));
    
    return serializeBigInt({ data: dataWithCounts, total, skip: Number(skip), take: Number(take) });
  }

  async findById(id: any) {
    const idBig = typeof id === 'bigint' ? id : BigInt(id);
    const item = await this.prisma.incomingCorrespondence.findUnique({
      where: { id: idBig },
      include: { senderEntity: true },
    });
    if (!item) throw new NotFoundException('المراسلة غير موجودة');
    
    // Get attachments via raw query
    const attachments = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, file_name as fileName, original_name as originalName, 
              file_path as filePath, mime_type as mimeType, file_size as fileSize,
              uploaded_at as uploadedAt
       FROM attachments 
       WHERE correspondence_type = 'incoming' AND correspondence_id = ?`,
      idBig
    );
    
    return serializeBigInt({ ...item, attachments });
  }

  async findOne(id: any) {
    return this.findById(id);
  }
}
