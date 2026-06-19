import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { AccessService } from '../../access/access.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
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
    // مدير النظام مُستثنى من قفل وقت الدوام
    if (user?.role?.name === 'super_admin') return true;

    // قفل تلقائي: الأجهزة الخارجية خارج وقت الدوام تُمنع من متابعة الجلسة
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '0.0.0.0';
    const policy = await this.access.evaluate(ip);
    if (!policy.allowed) {
      throw new ForbiddenException({
        code: 'OUTSIDE_HOURS',
        message: `خارج وقت الدوام المسموح (${policy.start} - ${policy.end}). يرجى المحاولة خلال أوقات الدوام أو من جهاز داخل الشركة.`,
      });
    }
    return true;
  }
}
