import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AllocationStatus, AllocationDocType, Prisma } from '@prisma/client';

// Roles allowed to manage allocation requests (mirror of correspondence EDIT_ROLES).
const MANAGE_ROLES = ['super_admin', 'archive_mgr', 'diwan_officer'];

// BigInt-safe JSON serializer
const serializeBigInt = (obj: any) =>
  JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));

// Standard required documents created with every new request.
const DEFAULT_DOCS: AllocationDocType[] = [
  AllocationDocType.kroki,
  AllocationDocType.realestate_cert,
  AllocationDocType.agriculture_approval,
  AllocationDocType.field_report,
];

@Injectable()
export class AllocationService {
  private readonly logger = new Logger(AllocationService.name);

  constructor(private prisma: PrismaService) {}

  private ensureCanManage(user: any) {
    const roleName = user?.role?.name;
    if (!MANAGE_ROLES.includes(roleName)) {
      throw new ForbiddenException('ليس لديك صلاحية إدارة طلبات التخصيص');
    }
  }

  private async logEvent(
    requestId: bigint,
    userId: bigint,
    action: string,
    fromStatus?: string | null,
    toStatus?: string | null,
    notes?: string | null,
  ) {
    await this.prisma.allocationEvent.create({
      data: { requestId, userId, action, fromStatus, toStatus, notes: notes || null },
    });
  }

  // ---------------------------------------------------------------------------
  // REQUESTS
  // ---------------------------------------------------------------------------

  async createRequest(data: any, user: any) {
    this.ensureCanManage(user);
    const userId = BigInt(user.id);

    // Generate serial number: ALC-YYYY-NNNNN
    const year = new Date().getFullYear();
    const last = await this.prisma.allocationRequest.findFirst({
      where: { serialNo: { startsWith: `ALC-${year}-` } },
      orderBy: { serialNo: 'desc' },
      select: { serialNo: true },
    });
    let next = 1;
    if (last) {
      const n = parseInt(last.serialNo.split('-')[2], 10);
      if (!isNaN(n)) next = n + 1;
    }
    const serialNo = `ALC-${year}-${String(next).padStart(5, '0')}`;

    const isOutsidePlan = data.isOutsidePlan === true || data.isOutsidePlan === 'true';

    try {
      const created = await this.prisma.allocationRequest.create({
        data: {
          serialNo,
          priorityNo: data.priorityNo ? Number(data.priorityNo) : null,
          receivedAt: new Date(data.receivedAt),
          requestingOfficeId: BigInt(data.requestingOfficeId),
          beneficiary: data.beneficiary || null,
          subject: data.subject,
          purpose: data.purpose || null,
          locationDesc: data.locationDesc || null,
          area: data.area || null,
          isOutsidePlan,
          priority: data.priority || 'normal',
          status: AllocationStatus.received,
          incomingId: data.incomingId ? BigInt(data.incomingId) : null,
          createdBy: userId,
          currentOwnerId: userId,
          // Seed the standard required-documents checklist. Agriculture approval
          // is only mandatory when the site lies outside the urban plan.
          documents: {
            create: DEFAULT_DOCS.map((docType) => ({
              docType,
              required:
                docType === AllocationDocType.agriculture_approval ? isOutsidePlan : true,
            })),
          },
        },
        include: { requestingOffice: true, documents: true },
      });

      await this.logEvent(created.id, userId, 'created', null, AllocationStatus.received, 'تسجيل طلب تخصيص جديد');
      this.logger.log(`✓ Allocation request created: ${serialNo}`);
      return serializeBigInt(created);
    } catch (error) {
      if (error.code === 'P2003') {
        throw new BadRequestException('المكتب المختص غير موجود في قاعدة البيانات');
      }
      this.logger.error(`❌ createRequest: ${error.message}`);
      throw new BadRequestException(`خطأ في حفظ الطلب: ${error.message}`);
    }
  }

  async findAll(params: any) {
    const { skip = 0, take = 50, status, priority, minutesId, search } = params || {};
    const where: Prisma.AllocationRequestWhereInput = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (minutesId) where.minutesId = BigInt(minutesId);
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { serialNo: { contains: search } },
        { beneficiary: { contains: search } },
        { requestingOffice: { nameAr: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.allocationRequest.findMany({
        where,
        skip: Number(skip),
        take: Number(take),
        orderBy: [{ priority: 'desc' }, { receivedAt: 'desc' }],
        include: {
          requestingOffice: { select: { id: true, nameAr: true } },
          minutes: { select: { id: true, minutesNo: true, status: true } },
          documents: { select: { id: true, docType: true, required: true, status: true } },
        },
      }),
      this.prisma.allocationRequest.count({ where }),
    ]);

    return serializeBigInt({ data, total, skip: Number(skip), take: Number(take) });
  }

  async findById(id: any) {
    const idBig = BigInt(id);
    const item = await this.prisma.allocationRequest.findUnique({
      where: { id: idBig },
      include: {
        requestingOffice: true,
        minutes: true,
        currentOwner: { select: { id: true, fullName: true, username: true } },
        creator: { select: { id: true, fullName: true, username: true } },
        documents: { orderBy: { id: 'asc' } },
        events: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });
    if (!item) throw new NotFoundException('طلب التخصيص غير موجود');

    // Attachments are stored polymorphically (same table as correspondence).
    const attachments = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, file_name as fileName, original_name as originalName,
              file_path as filePath, mime_type as mimeType, file_size as fileSize,
              uploaded_at as uploadedAt
       FROM attachments
       WHERE correspondence_type = 'allocation' AND correspondence_id = ?`,
      idBig,
    );

    return serializeBigInt({ ...item, attachments });
  }

  async updateRequest(id: any, data: any, user: any) {
    this.ensureCanManage(user);
    const idBig = BigInt(id);
    const existing = await this.prisma.allocationRequest.findUnique({ where: { id: idBig } });
    if (!existing) throw new NotFoundException('طلب التخصيص غير موجود');

    const d: Prisma.AllocationRequestUpdateInput = {};
    if (data.receivedAt !== undefined) d.receivedAt = new Date(data.receivedAt);
    if (data.priorityNo !== undefined) d.priorityNo = data.priorityNo ? Number(data.priorityNo) : null;
    if (data.beneficiary !== undefined) d.beneficiary = data.beneficiary || null;
    if (data.subject !== undefined) d.subject = data.subject;
    if (data.purpose !== undefined) d.purpose = data.purpose || null;
    if (data.locationDesc !== undefined) d.locationDesc = data.locationDesc || null;
    if (data.area !== undefined) d.area = data.area || null;
    if (data.isOutsidePlan !== undefined) d.isOutsidePlan = !!data.isOutsidePlan;
    if (data.priority !== undefined) d.priority = data.priority;
    if (data.requestingOfficeId !== undefined) {
      d.requestingOffice = { connect: { id: BigInt(data.requestingOfficeId) } };
    }

    const updated = await this.prisma.allocationRequest.update({
      where: { id: idBig },
      data: d,
      include: { requestingOffice: true },
    });
    await this.logEvent(idBig, BigInt(user.id), 'updated', existing.status, updated.status, 'تعديل بيانات الطلب');
    return serializeBigInt(updated);
  }

  // ---------------------------------------------------------------------------
  // WORKFLOW TRANSITIONS
  // ---------------------------------------------------------------------------

  private async getOrThrow(id: any) {
    const item = await this.prisma.allocationRequest.findUnique({ where: { id: BigInt(id) } });
    if (!item) throw new NotFoundException('طلب التخصيص غير موجود');
    return item;
  }

  private async transition(
    id: any,
    user: any,
    toStatus: AllocationStatus,
    allowedFrom: AllocationStatus[],
    action: string,
    extra: Prisma.AllocationRequestUpdateInput = {},
    notes?: string,
  ) {
    this.ensureCanManage(user);
    const existing = await this.getOrThrow(id);
    if (!allowedFrom.includes(existing.status)) {
      throw new BadRequestException(
        `لا يمكن تنفيذ هذا الإجراء والطلب في الحالة الحالية (${existing.status})`,
      );
    }
    const updated = await this.prisma.allocationRequest.update({
      where: { id: BigInt(id) },
      data: { status: toStatus, ...extra },
      include: { requestingOffice: true, minutes: true },
    });
    await this.logEvent(BigInt(id), BigInt(user.id), action, existing.status, toStatus, notes);
    return serializeBigInt(updated);
  }

  /** عرض الطلب على اللجنة للدراسة. */
  submitToCommittee(id: any, user: any, notes?: string) {
    return this.transition(
      id,
      user,
      AllocationStatus.under_review,
      [AllocationStatus.received, AllocationStatus.missing_docs],
      'submitted_to_committee',
      {},
      notes || 'عرض الطلب على اللجنة',
    );
  }

  /** تسجيل نواقص ومراسلة المكتب المختص لاستيفاء البيانات. */
  markMissing(id: any, user: any, notes?: string) {
    return this.transition(
      id,
      user,
      AllocationStatus.missing_docs,
      [AllocationStatus.received, AllocationStatus.under_review],
      'marked_missing',
      {},
      notes || 'الملف ناقص - مراسلة المكتب المختص لاستيفاء البيانات',
    );
  }

  /** قرار اللجنة (موافقة/عدم موافقة) على التخصيص. */
  async committeeDecision(id: any, user: any, decision: 'approve' | 'reject', notes?: string) {
    this.ensureCanManage(user);
    const existing = await this.getOrThrow(id);

    if (decision === 'approve') {
      // لا يجوز اعتماد التخصيص قبل استيفاء جميع المستندات المطلوبة.
      const missing = await this.prisma.allocationDocument.count({
        where: { requestId: BigInt(id), required: true, status: 'pending' },
      });
      if (missing > 0) {
        throw new BadRequestException(
          `لا يمكن الموافقة قبل استيفاء جميع المستندات المطلوبة (${missing} مستند ناقص)`,
        );
      }
    }

    const toStatus =
      decision === 'approve' ? AllocationStatus.committee_approved : AllocationStatus.committee_rejected;
    return this.transition(
      id,
      user,
      toStatus,
      [AllocationStatus.under_review, AllocationStatus.received],
      decision === 'approve' ? 'committee_approved' : 'committee_rejected',
      { committeeNotes: notes || null },
      notes || (decision === 'approve' ? 'موافقة اللجنة على التخصيص' : 'عدم موافقة اللجنة'),
    );
  }

  /** إضافة الطلب إلى محضر اللجنة برقم بند (1..12). */
  async assignToMinutes(id: any, user: any, minutesId: string, itemNo: number) {
    this.ensureCanManage(user);
    const existing = await this.getOrThrow(id);
    const decided: AllocationStatus[] = [
      AllocationStatus.committee_approved,
      AllocationStatus.committee_rejected,
    ];
    if (!decided.includes(existing.status)) {
      throw new BadRequestException('يجب أن تتخذ اللجنة قراراً قبل إدراج الطلب في المحضر');
    }

    const minutes = await this.prisma.committeeMinutes.findUnique({ where: { id: BigInt(minutesId) } });
    if (!minutes) throw new NotFoundException('المحضر غير موجود');
    if (minutes.status === 'cabinet_approved') {
      throw new BadRequestException('لا يمكن التعديل على محضر معتمد من مجلس الوزراء');
    }

    // رقم البند يجب أن يكون فريداً داخل المحضر.
    const clash = await this.prisma.allocationRequest.findFirst({
      where: { minutesId: BigInt(minutesId), minutesItemNo: itemNo, NOT: { id: BigInt(id) } },
    });
    if (clash) {
      throw new BadRequestException(`رقم البند ${itemNo} مستخدم بالفعل في هذا المحضر`);
    }

    const updated = await this.prisma.allocationRequest.update({
      where: { id: BigInt(id) },
      data: { minutesId: BigInt(minutesId), minutesItemNo: itemNo },
      include: { requestingOffice: true, minutes: true },
    });
    await this.logEvent(
      BigInt(id),
      BigInt(user.id),
      'assigned_to_minutes',
      existing.status,
      existing.status,
      `إدراج في ${minutes.minutesNo} بالبند رقم ${itemNo}`,
    );
    return serializeBigInt(updated);
  }

  /** تسجيل بيانات قرار التخصيص (الرقم/التاريخ) بعد الاعتماد. */
  async recordDecision(id: any, user: any, decisionNo?: string, decisionDate?: string) {
    this.ensureCanManage(user);
    const existing = await this.getOrThrow(id);
    if (existing.status !== AllocationStatus.approved) {
      throw new BadRequestException('لا يمكن تسجيل قرار التخصيص قبل اعتماد المحضر والموافقة');
    }
    const updated = await this.prisma.allocationRequest.update({
      where: { id: BigInt(id) },
      data: {
        decisionNo: decisionNo || null,
        decisionDate: decisionDate ? new Date(decisionDate) : null,
      },
      include: { requestingOffice: true, minutes: true },
    });
    await this.logEvent(
      BigInt(id),
      BigInt(user.id),
      'decision_recorded',
      existing.status,
      existing.status,
      `تسجيل قرار التخصيص${decisionNo ? ` رقم ${decisionNo}` : ''}`,
    );
    return serializeBigInt(updated);
  }

  // ---------------------------------------------------------------------------
  // DOCUMENTS CHECKLIST
  // ---------------------------------------------------------------------------

  async upsertDocument(requestId: any, user: any, body: any) {
    this.ensureCanManage(user);
    await this.getOrThrow(requestId);
    const doc = await this.prisma.allocationDocument.create({
      data: {
        requestId: BigInt(requestId),
        docType: body.docType,
        required: body.required ?? true,
        status: body.status ?? 'pending',
        notes: body.notes || null,
        receivedAt: body.status === 'received' ? new Date() : null,
      },
    });
    await this.logEvent(BigInt(requestId), BigInt(user.id), 'document_added', null, null, `إضافة مستند: ${body.docType}`);
    return serializeBigInt(doc);
  }

  async updateDocument(requestId: any, docId: any, user: any, body: any) {
    this.ensureCanManage(user);
    const doc = await this.prisma.allocationDocument.findFirst({
      where: { id: BigInt(docId), requestId: BigInt(requestId) },
    });
    if (!doc) throw new NotFoundException('المستند غير موجود');

    const d: Prisma.AllocationDocumentUpdateInput = {};
    if (body.notes !== undefined) d.notes = body.notes || null;
    if (body.required !== undefined) d.required = !!body.required;
    if (body.status !== undefined) {
      d.status = body.status;
      d.receivedAt = body.status === 'received' ? new Date() : null;
    }

    const updated = await this.prisma.allocationDocument.update({
      where: { id: BigInt(docId) },
      data: d,
    });
    await this.logEvent(
      BigInt(requestId),
      BigInt(user.id),
      'document_updated',
      null,
      null,
      `تحديث مستند ${doc.docType}${body.status ? ` → ${body.status}` : ''}`,
    );
    return serializeBigInt(updated);
  }

  // ---------------------------------------------------------------------------
  // COMMITTEE MINUTES (محضر اللجنة)
  // ---------------------------------------------------------------------------

  async listMinutes() {
    const items = await this.prisma.committeeMinutes.findMany({
      orderBy: { meetingDate: 'desc' },
      include: { _count: { select: { requests: true } } },
    });
    return serializeBigInt(items);
  }

  async createMinutes(data: any, user: any) {
    this.ensureCanManage(user);
    try {
      const created = await this.prisma.committeeMinutes.create({
        data: {
          minutesNo: data.minutesNo,
          meetingDate: new Date(data.meetingDate),
          notes: data.notes || null,
          createdBy: BigInt(user.id),
        },
      });
      return serializeBigInt(created);
    } catch (error) {
      if (error.code === 'P2002') throw new BadRequestException('رقم المحضر مستخدم بالفعل');
      throw new BadRequestException(`خطأ في إنشاء المحضر: ${error.message}`);
    }
  }

  async getMinutes(id: any) {
    const item = await this.prisma.committeeMinutes.findUnique({
      where: { id: BigInt(id) },
      include: {
        creator: { select: { id: true, fullName: true } },
        requests: {
          orderBy: { minutesItemNo: 'asc' },
          include: { requestingOffice: { select: { id: true, nameAr: true } } },
        },
      },
    });
    if (!item) throw new NotFoundException('المحضر غير موجود');
    return serializeBigInt(item);
  }

  /**
   * اعتماد المحضر من مجلس الوزراء: يُحسم مصير كل الطلبات المدرجة فيه؛
   * الموافَق عليها من اللجنة تصبح "معتمدة" (يصدر قرار تخصيص ويُحوّل للمكتب)،
   * وغير الموافَق عليها تصبح "مرفوضة" (يُبلّغ المكتب بعدم الموافقة).
   */
  async cabinetApproveMinutes(id: any, user: any) {
    this.ensureCanManage(user);
    const minutes = await this.prisma.committeeMinutes.findUnique({
      where: { id: BigInt(id) },
      include: { requests: true },
    });
    if (!minutes) throw new NotFoundException('المحضر غير موجود');
    if (minutes.status === 'cabinet_approved') {
      throw new BadRequestException('المحضر معتمد بالفعل من مجلس الوزراء');
    }
    if (minutes.requests.length === 0) {
      throw new BadRequestException('لا يمكن اعتماد محضر لا يحتوي على أي طلب');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.committeeMinutes.update({
        where: { id: BigInt(id) },
        data: { status: 'cabinet_approved', cabinetApprovedAt: now },
      });

      for (const req of minutes.requests) {
        let toStatus: AllocationStatus | null = null;
        if (req.status === AllocationStatus.committee_approved) toStatus = AllocationStatus.approved;
        else if (req.status === AllocationStatus.committee_rejected) toStatus = AllocationStatus.rejected;
        if (!toStatus) continue;

        await tx.allocationRequest.update({
          where: { id: req.id },
          data: { status: toStatus, cabinetApprovedAt: now },
        });
        await tx.allocationEvent.create({
          data: {
            requestId: req.id,
            userId: BigInt(user.id),
            action: 'cabinet_approved',
            fromStatus: req.status,
            toStatus,
            notes:
              toStatus === AllocationStatus.approved
                ? 'اعتماد المحضر بمجلس الوزراء - صدور قرار التخصيص وتحويله للمكتب المختص'
                : 'اعتماد المحضر بمجلس الوزراء - إبلاغ المكتب المختص بعدم الموافقة',
          },
        });
      }
    });

    return this.getMinutes(id);
  }

  // ---------------------------------------------------------------------------
  // STATS
  // ---------------------------------------------------------------------------

  async stats() {
    const grouped = await this.prisma.allocationRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      byStatus[g.status] = g._count._all;
      total += g._count._all;
    }
    return { total, byStatus };
  }
}
