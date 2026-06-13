import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        fullNameAr: true,
        jobTitle: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        role: {
          select: { id: true, name: true, nameAr: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    return user;
  }

  async findAll(params: { skip?: number; take?: number; departmentId?: bigint }) {
    const { skip = 0, take = 20, departmentId } = params;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        where: {
          isActive: true,
          ...(departmentId && { departmentId }),
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          jobTitle: true,
          role: { select: { name: true, nameAr: true } },
          department: { select: { name: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.user.count({
        where: { isActive: true, ...(departmentId && { departmentId }) },
      }),
    ]);

    return { data: users, total, skip, take };
  }
}
