import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Roles allowed to EDIT correspondence (the supervisor/admin only — the
// regular data-entry officer can register but not modify).
const EDIT_ROLES = ['super_admin', 'archive_mgr'];
// Roles that can see every correspondence regardless of visibility
const MANAGER_ROLES = ['super_admin', 'archive_mgr'];
// Roles allowed to route/refer (تهميش) correspondence to departments
const ROUTING_ROLES = ['super_admin', 'archive_mgr', 'dept_manager'];
// Roles allowed to take decision actions (اعتماد/رفض/إغلاق/أرشفة)
const DECISION_ROLES = ['super_admin', 'archive_mgr', 'dept_manager'];

// Workflow actions and the status each one moves the correspondence to.
const ACTION_TO_STATUS: Record<string, string | null> = {
  approve: 'approved',
  reject: 'rejected',
  return: 'returned',
  close: 'closed',
  archive: 'archived',
  note: null, // no status change
  print: null, // no status change
};
// Actions that require an explanatory note from the user
const NOTE_REQUIRED = ['reject', 'return', 'note'];
// Actions blocked once the correspondence is terminal (closed/archived)
const BLOCKED_WHEN_TERMINAL = ['approve', 'reject', 'return', 'refer'];
const TERMINAL_STATUSES = ['closed', 'archived'];
// Arabic labels for notification messages
const ACTION_LABEL_AR: Record<string, string> = {
  approve: 'اعتماد',
  reject: 'رفض',
  return: 'إعادة',
  close: 'إغلاق',
  archive: 'أرشفة',
  note: 'ملاحظة',
};

// ---- Security clearance (درجة السرية) ----
// أعلى درجة سرية يستطيع كل دور الاطّلاع عليها / تعيينها. يخضع له الجميع.
const CLEARANCE_BY_ROLE: Record<string, string> = {
  super_admin: 'top_secret',
  archive_mgr: 'top_secret',
  diwan_officer: 'secret',
  dept_manager: 'secret',
  employee: 'normal',
};
const CONF_RANK: Record<string, number> = { normal: 0, secret: 1, top_secret: 2 };

// رتبة تصريح المستخدم حسب دوره (الافتراضي: عادي)
const clearanceRank = (roleName?: string): number =>
  CONF_RANK[CLEARANCE_BY_ROLE[roleName || ''] ?? 'normal'] ?? 0;

// قائمة درجات السرية المسموح للمستخدم الاطّلاع عليها
const allowedConfLevels = (roleName?: string): string[] => {
  const max = clearanceRank(roleName);
  return Object.keys(CONF_RANK).filter((lvl) => CONF_RANK[lvl] <= max);
};

// BigInt JSON serializer helper
const serializeBigInt = (obj: any) => 
  JSON.parse(JSON.stringify(obj, (k, v) => typeof v === 'bigint' ? v.toString() : v));

@Injectable()
export class IncomingService {
  private readonly logger = new Logger(IncomingService.name);
  
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(data: any, user: any, ip?: any) {
    const userId = user?.id ?? user;
    this.logger.log(`Creating incoming - userId: ${userId}`);

    // لا يجوز تعيين درجة سرية أعلى من تصريح المستخدم
    const reqConf = data.confidentiality || 'normal';
    if ((CONF_RANK[reqConf] ?? 0) > clearanceRank(user?.role?.name)) {
      throw new ForbiddenException('ليس لديك التصريح الكافي لتعيين هذه الدرجة من السرية');
    }

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
        // الوارد الجديد مقيّد افتراضياً: يشاهده مُدخِله والمسؤولون فقط،
        // ولا يظهر لأي إدارة إلا بعد أن يوجّهه المدير إليها (route)
        visibility: data.visibility || 'private',
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
    // Confidentiality clearance filter — applies to EVERYONE (managers included)
    and.push({ confidentiality: { in: allowedConfLevels(user?.role?.name) } });
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

    // Get viewer counts (read tracking) for all items
    const viewCounts = ids.length > 0 ? await this.prisma.incomingView.groupBy({
      by: ['incomingId'],
      where: { incomingId: { in: ids } },
      _count: { id: true },
    }) : [];
    const viewMap = new Map(viewCounts.map((v: any) => [v.incomingId.toString(), Number(v._count.id)]));

    // Get routing (التوجيه) department names per item
    const routings = ids.length > 0 ? await this.prisma.incomingRouting.findMany({
      where: { incomingId: { in: ids } },
      select: { incomingId: true, departmentId: true },
    }) : [];
    const routeDeptIds = [...new Set(routings.map((r) => r.departmentId.toString()))];
    const routeDeptRows = routeDeptIds.length > 0 ? await this.prisma.department.findMany({
      where: { id: { in: routeDeptIds.map((d) => BigInt(d)) } },
      select: { id: true, name: true },
    }) : [];
    const deptNameMap = new Map(routeDeptRows.map((d) => [d.id.toString(), d.name]));
    const routedMap = new Map<string, Set<string>>();
    for (const r of routings) {
      const key = r.incomingId.toString();
      if (!routedMap.has(key)) routedMap.set(key, new Set());
      const name = deptNameMap.get(r.departmentId.toString());
      if (name) routedMap.get(key)!.add(name);
    }

    const dataWithCounts = data.map((d: any) => ({
      ...d,
      attachmentCount: countMap.get(d.id.toString()) || 0,
      viewersCount: viewMap.get(d.id.toString()) || 0,
      routedTo: Array.from(routedMap.get(d.id.toString()) || []),
    }));

    return serializeBigInt({ data: dataWithCounts, total, skip: Number(skip), take: Number(take) });
  }

  async findById(id: any, user?: any, ip?: string, userAgent?: string) {
    const idBig = typeof id === 'bigint' ? id : BigInt(id);
    const item = await this.prisma.incomingCorrespondence.findUnique({
      where: { id: idBig },
      include: {
        senderEntity: true,
        visibilityDepts: true,
        routings: {
          orderBy: { createdAt: 'desc' },
          include: { routedByUser: { select: { fullName: true } } },
        },
        actions: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { fullName: true, department: { select: { name: true } } } } },
        },
      },
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

    // ---- Access control by confidentiality clearance (applies to everyone) ----
    if (clearanceRank(user?.role?.name) < (CONF_RANK[item.confidentiality] ?? 0)) {
      throw new ForbiddenException('ليس لديك التصريح الأمني الكافي لمشاهدة هذه المراسلة');
    }

    // ---- Record the view (not for the creator) ----
    // First open by a user is also logged in the timeline as an "open" action.
    if (userIdBig != null && !isCreator) {
      try {
        const existingView = await this.prisma.incomingView.findUnique({
          where: { incomingId_userId: { incomingId: idBig, userId: userIdBig } },
          select: { id: true },
        });
        if (existingView) {
          await this.prisma.incomingView.update({
            where: { incomingId_userId: { incomingId: idBig, userId: userIdBig } },
            data: { lastViewedAt: new Date(), viewCount: { increment: 1 } },
          });
        } else {
          await this.prisma.incomingView.create({
            data: { incomingId: idBig, userId: userIdBig },
          });
          await this.prisma.incomingAction.create({
            data: { incomingId: idBig, actorId: userIdBig, action: 'open' },
          });
          // سجلّ الوصول: أول فتح للمعاملة من هذا المستخدم
          void this.writeAudit({ userId: userIdBig, action: 'CORRESPONDENCE_VIEWED', entityId: idBig, ip, userAgent });
        }
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
    const routingDeptIds = item.routings.map((r) => r.departmentId);
    const allDeptIds = [...new Set([...visibilityDeptIds, ...routingDeptIds].map((d) => d.toString()))];
    const deptRows = allDeptIds.length
      ? await this.prisma.department.findMany({
          where: { id: { in: allDeptIds.map((d) => BigInt(d)) } },
          select: { id: true, name: true },
        })
      : [];
    const deptNameMap = new Map(deptRows.map((d) => [d.id.toString(), d.name]));
    const visibilityDeptNames = visibilityDeptIds.map((d) => deptNameMap.get(d.toString())).filter(Boolean);

    // Routing history (التوجيه / التهميش)
    const routings = item.routings.map((r) => ({
      id: r.id,
      departmentId: r.departmentId,
      departmentName: deptNameMap.get(r.departmentId.toString()) || null,
      note: r.note,
      routedBy: r.routedByUser?.fullName || null,
      createdAt: r.createdAt,
    }));

    // Action log / timeline (سجل حركة المعاملة)
    const actions = item.actions.map((a) => ({
      id: a.id,
      action: a.action,
      note: a.note,
      fromStatus: a.fromStatus,
      toStatus: a.toStatus,
      actorName: a.actor?.fullName || null,
      actorDepartment: a.actor?.department?.name || null,
      createdAt: a.createdAt,
    }));

    return serializeBigInt({ ...item, attachments, viewers, visibilityDeptIds, visibilityDeptNames, routings, actions });
  }

  async findOne(id: any, user?: any) {
    return this.findById(id, user);
  }

  /** يحسب الفروقات بين القيم القديمة و الجديدة (الحقول المتغيّرة فقط). */
  private diffChanges(existing: any, updateData: any): { oldValues: any; newValues: any } {
    const norm = (v: any) =>
      v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? v.toString() : v ?? null;
    const oldValues: any = {};
    const newValues: any = {};
    for (const key of Object.keys(updateData)) {
      const before = norm((existing as any)[key]);
      const after = norm(updateData[key]);
      if (String(before ?? '') !== String(after ?? '')) {
        oldValues[key] = before;
        newValues[key] = after;
      }
    }
    return { oldValues, newValues };
  }

  /** يكتب سطراً في سجلّ التدقيق (fire-and-forget) لا يُفشل العملية الأساسية. */
  private async writeAudit(params: {
    userId: any;
    action: string;
    entityId: bigint;
    oldValues?: any;
    newValues?: any;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: BigInt(params.userId),
          action: params.action,
          entityType: 'incoming',
          entityId: params.entityId,
          oldValues: params.oldValues ?? undefined,
          newValues: params.newValues ?? undefined,
          ipAddress: params.ip || '0.0.0.0',
          userAgent: params.userAgent || null,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Audit write failed (${params.action}): ${e.message}`);
    }
  }

  /** سجلّ التعديلات التفصيلي لمراسلة — لمدير النظام فقط. */
  async getAuditLog(id: any, user: any) {
    if (user?.role?.name !== 'super_admin') {
      throw new ForbiddenException('سجلّ التعديلات متاح لمدير النظام فقط');
    }
    const idBig = typeof id === 'bigint' ? id : BigInt(id);
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType: 'incoming', entityId: idBig },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { fullName: true, fullNameAr: true, department: { select: { name: true } } },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      action: r.action,
      actorName: r.user?.fullNameAr || r.user?.fullName || null,
      actorDepartment: r.user?.department?.name || null,
      oldValues: r.oldValues,
      newValues: r.newValues,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
    }));
  }

  /**
   * يرجع ببيانات المراسلة إلى ما كانت عليه قبل تعديل سابق (من سجلّ التدقيق).
   * لمدير النظام فقط. يُطبّق القيم القديمة عبر update فيُسجَّل الاسترجاع كتعديل جديد.
   */
  async restoreAudit(id: any, auditId: any, user: any, ip?: string, userAgent?: string) {
    if (user?.role?.name !== 'super_admin') {
      throw new ForbiddenException('الاسترجاع متاح لمدير النظام فقط');
    }
    const idBig = typeof id === 'bigint' ? id : BigInt(id);
    const entry = await this.prisma.auditLog.findUnique({ where: { id: BigInt(auditId) } });
    if (!entry || entry.entityType !== 'incoming' || entry.entityId?.toString() !== idBig.toString()) {
      throw new NotFoundException('سجلّ التعديل غير موجود');
    }
    if (
      (entry.action !== 'UPDATE' && entry.action !== 'RESTORE') ||
      !entry.oldValues ||
      typeof entry.oldValues !== 'object'
    ) {
      throw new BadRequestException('هذا السطر لا يحتوي على بيانات قابلة للاسترجاع');
    }
    // تطبيق القيم القديمة (update يتكفّل بتحويل الأنواع وتسجيل العملية كـ«استرجاع»)
    return this.update(idBig, entry.oldValues as any, user, ip, 'RESTORE', userAgent);
  }

  async update(id: any, data: any, user: any, ip?: string, auditAction: string = 'UPDATE', userAgent?: string) {
    const roleName = user?.role?.name;
    if (!EDIT_ROLES.includes(roleName)) {
      throw new ForbiddenException('ليس لديك صلاحية تعديل المراسلات');
    }

    const idBig = typeof id === 'bigint' ? id : BigInt(id);
    const existing = await this.prisma.incomingCorrespondence.findUnique({ where: { id: idBig } });
    if (!existing) throw new NotFoundException('المراسلة غير موجودة');

    // درجة السرية الحالية يجب ألا تتجاوز تصريح المستخدم، وكذلك الدرجة الجديدة
    const myRank = clearanceRank(roleName);
    if (myRank < (CONF_RANK[existing.confidentiality] ?? 0)) {
      throw new ForbiddenException('ليس لديك التصريح الأمني الكافي لتعديل هذه المراسلة');
    }
    if (data.confidentiality !== undefined && (CONF_RANK[data.confidentiality] ?? 0) > myRank) {
      throw new ForbiddenException('ليس لديك التصريح الكافي لتعيين هذه الدرجة من السرية');
    }

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

      // سجلّ التدقيق: ما الحقول التي تغيّرت (قيمة قديمة ← جديدة) — لمدير النظام
      const { oldValues, newValues } = this.diffChanges(existing, updateData);
      if (Object.keys(newValues).length) {
        void this.writeAudit({
          userId: user?.id,
          action: auditAction,
          entityId: idBig,
          oldValues,
          newValues,
          ip,
          userAgent,
        });
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

  // التوجيه / التهميش — direct the message to one or more departments
  async route(id: any, data: any, user: any) {
    const roleName = user?.role?.name;
    if (!ROUTING_ROLES.includes(roleName)) {
      throw new ForbiddenException('ليس لديك صلاحية توجيه المراسلات');
    }
    const idBig = typeof id === 'bigint' ? id : BigInt(id);
    const item = await this.prisma.incomingCorrespondence.findUnique({ where: { id: idBig } });
    if (!item) throw new NotFoundException('المراسلة غير موجودة');

    if (TERMINAL_STATUSES.includes(item.status)) {
      throw new BadRequestException('لا يمكن إحالة معاملة مغلقة أو مؤرشفة');
    }

    const deptIds: string[] = Array.isArray(data?.departmentIds) ? data.departmentIds : [];
    if (!deptIds.length) throw new BadRequestException('اختر إدارة واحدة على الأقل للتوجيه');
    const note = data?.note?.trim() || null;
    const userIdBig = BigInt(user.id);

    // routing records (one per department)
    await this.prisma.incomingRouting.createMany({
      data: deptIds.map((d) => ({ incomingId: idBig, departmentId: BigInt(d), note, routedBy: userIdBig })),
    });

    // grant the routed departments visibility on the message
    await this.prisma.incomingVisibilityDept.createMany({
      data: deptIds.map((d) => ({ incomingId: idBig, departmentId: BigInt(d) })),
      skipDuplicates: true,
    });

    // make the routed departments effective + mark as in progress
    await this.prisma.incomingCorrespondence.update({
      where: { id: idBig },
      data: {
        visibility: item.visibility === 'public' ? 'public' : 'departments',
        status: item.status === 'new' ? 'in_progress' : item.status,
      },
    });

    // log the referral in the timeline
    await this.prisma.incomingAction.create({
      data: {
        incomingId: idBig,
        actorId: userIdBig,
        action: 'refer',
        note,
        fromStatus: item.status,
        toStatus: item.status === 'new' ? 'in_progress' : item.status,
      },
    });

    // notify the members of the routed departments
    await this.notifyDepartments(deptIds, userIdBig, {
      type: 'transfer',
      title: 'أُحيلت إليك معاملة واردة',
      body: `${item.serialNo} — ${item.subject}`,
      actionUrl: `/inbox/${idBig}`,
      relatedType: 'incoming',
      relatedId: idBig,
    });

    this.logger.log(`✓ Routed correspondence ${idBig} to depts [${deptIds.join(',')}] by ${user?.username}`);
    return this.findById(idBig, user);
  }

  /**
   * إجراءات إدارة المعاملة: اعتماد/رفض/إعادة/ملاحظة/طباعة/إغلاق/أرشفة.
   * الفتح يُسجَّل تلقائياً عند عرض التفاصيل.
   */
  async act(id: any, action: string, data: any, user: any) {
    const roleName = user?.role?.name;
    const idBig = typeof id === 'bigint' ? id : BigInt(id);
    const userIdBig = BigInt(user.id);

    if (!(action in ACTION_TO_STATUS)) {
      throw new BadRequestException('إجراء غير معروف');
    }

    const item = await this.prisma.incomingCorrespondence.findUnique({
      where: { id: idBig },
      include: { visibilityDepts: true, routings: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!item) throw new NotFoundException('المراسلة غير موجودة');

    // ---- Access control (same rules as viewing) ----
    const isManager = MANAGER_ROLES.includes(roleName);
    const deptBig = user?.departmentId ? BigInt(user.departmentId) : undefined;
    const isCreator = item.createdBy === userIdBig;
    const isOwner = item.currentOwnerId === userIdBig;
    const deptAllowed =
      item.visibility === 'departments' && deptBig != null &&
      item.visibilityDepts.some((v) => v.departmentId === deptBig);
    const canView = isManager || item.visibility === 'public' || isCreator || isOwner || deptAllowed;
    if (!canView) throw new ForbiddenException('ليس لديك صلاحية الوصول لهذه المراسلة');
    if (clearanceRank(roleName) < (CONF_RANK[item.confidentiality] ?? 0)) {
      throw new ForbiddenException('ليس لديك التصريح الأمني الكافي لهذه المراسلة');
    }

    // ---- Permission per action: decisions are for managers only ----
    const isDecision = ['approve', 'reject', 'close', 'archive'].includes(action);
    if (isDecision && !DECISION_ROLES.includes(roleName)) {
      throw new ForbiddenException('هذا الإجراء متاح للمدراء فقط');
    }

    // ---- Status guards (note/print are always allowed, even when archived) ----
    if (BLOCKED_WHEN_TERMINAL.includes(action) && TERMINAL_STATUSES.includes(item.status)) {
      throw new BadRequestException('لا يمكن تنفيذ هذا الإجراء على معاملة مغلقة أو مؤرشفة');
    }
    if (action === 'archive' && item.status === 'archived') {
      throw new BadRequestException('المعاملة مؤرشفة بالفعل');
    }
    if (action === 'close' && TERMINAL_STATUSES.includes(item.status)) {
      throw new BadRequestException('المعاملة مغلقة أو مؤرشفة بالفعل');
    }

    // ---- Note requirement ----
    const note = data?.note?.trim() || null;
    if (NOTE_REQUIRED.includes(action) && !note) {
      throw new BadRequestException('يجب إدخال ملاحظة/سبب لهذا الإجراء');
    }

    // ---- Apply status change (if any) ----
    const toStatus = ACTION_TO_STATUS[action];
    if (toStatus) {
      await this.prisma.incomingCorrespondence.update({
        where: { id: idBig },
        data: { status: toStatus as any },
      });
    }

    // ---- Log in the timeline ----
    await this.prisma.incomingAction.create({
      data: {
        incomingId: idBig,
        actorId: userIdBig,
        action: action as any,
        note,
        fromStatus: item.status,
        toStatus: toStatus ?? null,
      },
    });

    // ---- Notifications ----
    await this.notifyForAction(action, item, userIdBig, note);

    this.logger.log(`✓ Action '${action}' on incoming ${idBig} by ${user?.username}`);
    return this.findById(idBig, user);
  }

  /** Notify the members of the given departments (excluding the actor). */
  private async notifyDepartments(deptIds: string[], actorId: bigint, payload: any) {
    try {
      const members = await this.prisma.user.findMany({
        where: { departmentId: { in: deptIds.map((d) => BigInt(d)) }, isActive: true },
        select: { id: true },
      });
      const recipients = members.map((m) => m.id).filter((uid) => uid !== actorId);
      await this.notifications.notifyMany(recipients, payload);
    } catch (e) {
      this.logger.warn(`Could not send routing notifications: ${e.message}`);
    }
  }

  /** Notify the relevant people when a decision/return/note happens. */
  private async notifyForAction(action: string, item: any, actorId: bigint, note: string | null) {
    try {
      const label = ACTION_LABEL_AR[action] || action;
      const body = `${item.serialNo} — ${item.subject}`;
      const base = { actionUrl: `/inbox/${item.id}`, relatedType: 'incoming', relatedId: item.id };

      if (action === 'approve' || action === 'reject') {
        // notify the creator and current owner of the decision
        await this.notifications.notifyMany(
          [item.createdBy, item.currentOwnerId].filter((u) => u && u !== actorId),
          { type: 'approval', title: `تم ${label} معاملتك الواردة`, body, ...base },
        );
      } else if (action === 'return') {
        // send back to the last person who referred it, or the creator
        const lastReferrer = item.routings?.[0]?.routedBy;
        const target = lastReferrer && lastReferrer !== actorId ? lastReferrer : item.createdBy;
        await this.notifications.notifyMany(
          [target].filter((u) => u && u !== actorId),
          { type: 'transfer', title: 'أُعيدت إليك معاملة واردة', body, ...base },
        );
      }
      // note/print/close/archive: no notification (kept quiet to avoid noise)
    } catch (e) {
      this.logger.warn(`Could not send action notifications: ${e.message}`);
    }
  }
}
