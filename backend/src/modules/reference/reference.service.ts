import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const serializeBigInt = (obj: any) =>
  JSON.parse(JSON.stringify(obj, (k, v) => (typeof v === 'bigint' ? v.toString() : v)));

@Injectable()
export class ReferenceService {
  constructor(private prisma: PrismaService) {}

  async entities() {
    const items = await this.prisma.externalEntity.findMany({
      where: { isActive: true },
      orderBy: { nameAr: 'asc' },
      select: { id: true, name: true, nameAr: true, type: true },
    });
    return serializeBigInt(items);
  }

  async createEntity(data: any) {
    const nameAr = (data?.nameAr || '').trim();
    if (!nameAr) throw new BadRequestException('اسم الجهة مطلوب');
    const entity = await this.prisma.externalEntity.create({
      data: {
        name: (data?.name || '').trim() || nameAr,
        nameAr,
        type: data?.type || 'government',
      },
      select: { id: true, name: true, nameAr: true, type: true },
    });
    return serializeBigInt(entity);
  }

  async departments() {
    const items = await this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return serializeBigInt(items);
  }

  async createDepartment(data: any) {
    const name = (data?.name || '').trim();
    if (!name) throw new BadRequestException('اسم الإدارة مطلوب');
    // auto-generate a unique code
    const code = `DEP-${Date.now().toString(36).toUpperCase()}`;
    const dep = await this.prisma.department.create({
      data: { name, code },
      select: { id: true, name: true, code: true },
    });
    return serializeBigInt(dep);
  }

  // ----- TRANSACTION TYPES (نوع المعاملة) -----

  async transactionTypes() {
    const items = await this.prisma.transactionType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return serializeBigInt(items);
  }

  async createTransactionType(data: any) {
    const name = (data?.name || '').trim();
    if (!name) throw new BadRequestException('اسم نوع المعاملة مطلوب');
    const existing = await this.prisma.transactionType.findUnique({ where: { name } });
    if (existing) {
      // re-activate if it was previously removed
      if (!existing.isActive) {
        const revived = await this.prisma.transactionType.update({
          where: { id: existing.id },
          data: { isActive: true },
          select: { id: true, name: true },
        });
        return serializeBigInt(revived);
      }
      throw new BadRequestException('نوع المعاملة موجود مسبقاً');
    }
    const created = await this.prisma.transactionType.create({
      data: { name },
      select: { id: true, name: true },
    });
    return serializeBigInt(created);
  }

  async updateTransactionType(id: string, data: any) {
    const name = (data?.name || '').trim();
    if (!name) throw new BadRequestException('اسم نوع المعاملة مطلوب');
    const dup = await this.prisma.transactionType.findUnique({ where: { name } });
    if (dup && dup.id !== BigInt(id)) {
      throw new BadRequestException('يوجد نوع معاملة آخر بنفس الاسم');
    }
    const updated = await this.prisma.transactionType.update({
      where: { id: BigInt(id) },
      data: { name },
      select: { id: true, name: true },
    });
    return serializeBigInt(updated);
  }

  async deleteTransactionType(id: string) {
    // soft delete to preserve the type label on historical correspondences
    await this.prisma.transactionType.update({
      where: { id: BigInt(id) },
      data: { isActive: false },
    });
    return { success: true };
  }
}
