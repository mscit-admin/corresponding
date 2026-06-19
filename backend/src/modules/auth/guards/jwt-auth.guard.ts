import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ExternalAccessService } from '../external-access.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly externalAccess: ExternalAccessService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // تحقّق من الـJWT أولاً (يضبط req.user)
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    // مدير النظام مُستثنى من قيود الدخول الخارجي
    if (user?.role?.name === 'super_admin') return true;

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '0.0.0.0';
    const companyDevice = await this.externalAccess.isCompanyIp(ip);
    if (companyDevice) return true; // داخل الشبكة — مسموح

    // خارج الشبكة: يجب وجود تصريح دخول خارجي ساري لهذا الجهاز
    const deviceId = (req.headers['x-device-id'] as string) || '';
    const allowed = await this.externalAccess.hasActiveGrant(BigInt(user.id), deviceId);
    if (!allowed) {
      throw new ForbiddenException({
        code: 'EXTERNAL_GRANT_EXPIRED',
        message: 'انتهت صلاحية تصريح الدخول الخارجي أو لم تتم الموافقة عليه. يرجى تسجيل الدخول من جديد.',
      });
    }
    return true;
  }
}
