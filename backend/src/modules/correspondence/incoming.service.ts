import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Roles allowed to EDIT correspondence (the supervisor/admin only — the
// regular data-entry officer can register but not modify).
const EDIT_ROLES = ['super_admin', 'archive_mgr'];
// Roles that can see every correspondence regardless of visibility
const MANAGER_ROLES = ['super_admin', 'archive_mgr'];

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
        registryNo: data.registryNo || null,
        receivedAt: new Date(data.receivedAt),
        senderEntityId: senderEntityIdBig,
        senderRefNo: data.senderRefNo || null,
        originalDate: data.originalDate ? new Date(data.originalDate) : null,
        subject: data.subject,
        transactionType: data.transactionType || null,
        priority: data.priority || 'normal',
        confidentiality: data.confidentiality || 'normal',
        visibility: data.visibility || 'public',
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

      // Allowed departments when visibility = departments
      if (createData.visibility === 'departments' && Array.isArray(data.visibilityDeptIds) && data.visibilityDeptIds.length) {
        await this.prisma.incomingVisibilityDept.createMany({
          data: data.visibilityDeptIds.map((d: any) => ({ incomingId: correspondence.id, departmentId: BigInt(d) })),
          skipDuplicates: true,
        });
      }

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

  async findAll(params: any, user?: any) {
    const { skip = 0, take = 20, status, search } = params || {};
    const userIdBig = user?.id ? BigInt(user.id) : undefined;
    const deptBig = user?.departmentId ? BigInt(user.departmentId) : undefined;
    const isManager = MANAGER_ROLES.includes(user?.role?.name);

    const where: any = {};
    const and: any[] = [];
    if (status) where.status = status;
    if (search) {
      and.push({
        OR: [
          { subject: { contains: search } },
          { serialNo: { contains: search } },
          { registryNo: { contains: search } },
          { senderRefNo: { contains: search } },
          { recipientName: { contains: search } },
          { senderEntity: { nameAr: { contains: search } } },
        ],
      });
    }
    // Visibility filter (managers see everything)
    if (!isManager && userIdBig) {
      const vis: any[] = [
        { visibility: 'public' },
        { createdBy: userIdBig },
        { currentOwnerId: userIdBig },
      ];
      if (deptBig) vis.push({ visibility: 'departments', visibilityDepts: { some: { departmentId: deptBig } } });
      and.push({ OR: vis });
    }
    if (and.length) where.AND = and;

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

  async findById(id: any, user?: any) {
    const idBig = typeof id === 'bigint' ? id : BigInt(id);
    const item = await this.prisma.incomingCorrespondence.findUnique({
      where: { id: idBig },
      include: { senderEntity: true, visibilityDepts: true },
    });
    if (!item) throw new NotFoundException('المراسلة غير موجودة');

    // ---- Access control by visibility ----
    const isManager = MANAGER_ROLES.includes(user?.role?.name);
    const userIdBig = user?.id ? BigInt(user.id) : undefined;
    const deptBig = user?.departmentId ? BigInt(user.departmentId) : undefined;
    const isCreator = userIdBig != null && item.createdBy === userIdBig;
    const isOwner = userIdBig != null && item.currentOwnerId === userIdBig;
    const deptAllowed =
      item.visibility === 'departments' && deptBig != null &&
      item.visibilityDepts.some((v) => v.departmentId === deptBig);
    const canView = isManager || item.visibility === 'public' || isCreator || isOwner || deptAllowed;
    if (!canView) {
      throw new ForbiddenException('ليس لديك صلاحية مشاهدة هذه المراسلة');
    }

    // ---- Record the view (not for the creator) ----
    if (userIdBig != null && !isCreator) {
      try {
        await this.prisma.incomingView.upsert({
          where: { incomingId_userId: { incomingId: idBig, userId: userIdBig } },
          update: { lastViewedAt: new Date(), viewCount: { increment: 1 } },
          create: { incomingId: idBig, userId: userIdBig },
        });
      } catch (e) {
        this.logger.warn(`Could not record view: ${e.message}`);
      }
    }

    // Attachments (raw query — table not in Prisma schema)
    const attachments = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, file_name as fileName, original_name as originalName,
              file_path as filePath, mime_type as mimeType, file_size as fileSize,
              uploaded_at as uploadedAt
       FROM attachments
       WHERE correspondence_type = 'incoming' AND correspondence_id = ?`,
      idBig,
    );

    // Viewers (read tracking)
    const viewsRaw = await this.prisma.incomingView.findMany({
      where: { incomingId: idBig },
      orderBy: { lastViewedAt: 'desc' },
      include: { user: { select: { fullName: true, department: { select: { name: true } } } } },
    });
    const viewers = viewsRaw.map((v) => ({
      userId: v.userId,
      fullName: v.user.fullName,
      department: v.user.department?.name || null,
      lastViewedAt: v.lastViewedAt,
      viewCount: v.viewCount,
    }));

    // Allowed-department names (for display)
    const visibilityDeptIds = item.visibilityDepts.map((v) => v.departmentId);
    let visibilityDeptNames: string[] = [];
    if (visibilityDeptIds.length) {
      const depts = await this.prisma.department.findMany({
        where: { id: { in: visibilityDeptIds } },
        select: { name: true },
      });
      visibilityDeptNames = depts.map((d) => d.name);
    }

    return serializeBigInt({ ...item, attachments, viewers, visibilityDeptIds, visibilityDeptNames });
  }

  async findOne(id: any, user?: any) {
    return this.findById(id, user);
  }

  async update(id: any, data: any, user: any) {
    const roleName = user?.role?.name;
    if (!EDIT_ROLES.includes(roleName)) {
      throw new ForbiddenException('ليس لديك صلاحية تعديل المراسلات');
    }

    const idBig = typeof id === 'bigint' ? id : BigInt(id);
    const existing = await this.prisma.incomingCorrespondence.findUnique({ where: { id: idBig } });
    if (!existing) throw new NotFoundException('المراسلة غير موجودة');

    const updateData: any = {};
    if (data.receivedAt !== undefined) updateData.receivedAt = new Date(data.receivedAt);
    if (data.registryNo !== undefined) updateData.registryNo = data.registryNo || null;
    if (data.senderEntityId !== undefined) updateData.senderEntityId = BigInt(data.senderEntityId);
    if (data.senderRefNo !== undefined) updateData.senderRefNo = data.senderRefNo || null;
    if (data.originalDate !== undefined) updateData.originalDate = data.originalDate ? new Date(data.originalDate) : null;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.transactionType !== undefined) updateData.transactionType = data.transactionType || null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.confidentiality !== undefined) updateData.confidentiality = data.confidentiality;
    if (data.recipientType !== undefined) updateData.recipientType = data.recipientType || null;
    if (data.recipientName !== undefined) updateData.recipientName = data.recipientName || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;
    if (data.currentOwnerId !== undefined) {
      updateData.currentOwnerId = data.currentOwnerId ? BigInt(data.currentOwnerId) : null;
    }

    try {
      const updated = await this.prisma.incomingCorrespondence.update({
        where: { id: idBig },
        data: updateData,
        include: { senderEntity: true },
      });

      // Sync allowed departments when visibility / list changes
      if (data.visibility !== undefined || data.visibilityDeptIds !== undefined) {
        const finalVisibility = data.visibility !== undefined ? data.visibility : existing.visibility;
        await this.prisma.incomingVisibilityDept.deleteMany({ where: { incomingId: idBig } });
        if (finalVisibility === 'departments' && Array.isArray(data.visibilityDeptIds) && data.visibilityDeptIds.length) {
          await this.prisma.incomingVisibilityDept.createMany({
            data: data.visibilityDeptIds.map((d: any) => ({ incomingId: idBig, departmentId: BigInt(d) })),
            skipDuplicates: true,
          });
        }
      }

      this.logger.log(`✓ Updated correspondence id: ${idBig} by ${user?.username}`);
      return serializeBigInt(updated);
    } catch (error) {
      if (error.code === 'P2003') {
        throw new BadRequestException('الجهة المرسلة غير موجودة في قاعدة البيانات');
      }
      throw new BadRequestException(`خطأ في تعديل المراسلة: ${error.message}`);
    }
  }
}
