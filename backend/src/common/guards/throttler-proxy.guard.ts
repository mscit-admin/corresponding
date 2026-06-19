import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * حارس تحديد المعدّل خلف بروكسي موثوق: يحسب مفتاح التتبّع من آخر عنوان في
 * سلسلة X-Forwarded-For (وهو ما يضيفه البروكسي = العميل الحقيقي وغير قابل
 * للتزوير) بدل أوّل عنوان الذي يستطيع العميل انتحاله للتهرّب من الحدّ.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const xff = req.headers?.['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length) {
      const parts = xff.split(',').map((p: string) => p.trim()).filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
