import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// طول متجه الوصف في face-api (FaceRecognitionNet)
const DESCRIPTOR_LENGTH = 128;
// عتبة المسافة الإقليدية للمطابقة (أقل = أكثر تشابهاً). 0.6 شائعة؛ نستخدم 0.5 لتشدّد أعلى.
const MATCH_THRESHOLD = 0.5;

@Injectable()
export class FaceService {
  constructor(private readonly prisma: PrismaService) {}

  private validateDescriptor(descriptor: unknown): number[] {
    if (!Array.isArray(descriptor) || descriptor.length !== DESCRIPTOR_LENGTH) {
      throw new BadRequestException('بيانات بصمة الوجه غير صحيحة');
    }
    const arr = descriptor.map((x) => Number(x));
    if (arr.some((x) => !Number.isFinite(x))) {
      throw new BadRequestException('بيانات بصمة الوجه غير صحيحة');
    }
    return arr;
  }

  private euclidean(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  /** هل سجّل المستخدم بصمة وجهه؟ */
  async status(userId: bigint | string): Promise<{ enrolled: boolean; enrolledAt: Date | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { faceDescriptor: true, faceEnrolledAt: true },
    });
    return { enrolled: !!user?.faceDescriptor, enrolledAt: user?.faceEnrolledAt ?? null };
  }

  /** تسجيل/تحديث بصمة وجه المستخدم. */
  async enroll(userId: bigint | string, descriptor: unknown): Promise<{ ok: boolean; enrolledAt: Date }> {
    const arr = this.validateDescriptor(descriptor);
    const enrolledAt = new Date();
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { faceDescriptor: arr, faceEnrolledAt: enrolledAt },
    });
    return { ok: true, enrolledAt };
  }

  /** حذف بصمة الوجه (إعادة تعيين). */
  async reset(userId: bigint | string): Promise<{ ok: boolean }> {
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { faceDescriptor: Prisma.DbNull, faceEnrolledAt: null },
    });
    return { ok: true };
  }

  /**
   * يطابق متّجه وجه مُرسَل مع المتّجه المحفوظ للمستخدم.
   * يرمي استثناءً واضحاً عند عدم التسجيل أو عدم التطابق.
   */
  async verify(userId: bigint | string, descriptor: unknown): Promise<{ match: boolean; distance: number }> {
    const arr = this.validateDescriptor(descriptor);
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { faceDescriptor: true },
    });
    const stored = user?.faceDescriptor as unknown as number[] | null;
    if (!stored || !Array.isArray(stored) || stored.length !== DESCRIPTOR_LENGTH) {
      throw new BadRequestException({
        code: 'FACE_NOT_ENROLLED',
        message: 'لم تُسجّل بصمة وجهك بعد. يرجى تسجيلها أولاً من صفحة بصمة الوجه.',
      });
    }
    const distance = this.euclidean(arr, stored);
    return { match: distance <= MATCH_THRESHOLD, distance };
  }
}
