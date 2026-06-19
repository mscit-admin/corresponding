import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService, DeviceContext } from './auth.service';
import { ExternalAccessService } from './external-access.service';
import {
  LoginDto,
  LoginResponseDto,
  RequestDeviceApprovalDto,
  RequestExternalCodeDto,
  SubmitExternalRequestDto,
  ExternalLockDto,
} from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';

/** يستخرج سياق الجهاز (IP والترويسات) من الطلب. */
function deviceCtx(req: Request): DeviceContext {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '0.0.0.0',
    userAgent: req.headers['user-agent'] as string,
    deviceMac: req.headers['x-device-mac'] as string,
    deviceHost: req.headers['x-device-host'] as string,
    deviceId: req.headers['x-device-id'] as string,
  };
}

function ensureSuperAdmin(req: any) {
  if (req.user?.role?.name !== 'super_admin') {
    throw new ForbiddenException('هذه العملية متاحة لمدير النظام فقط');
  }
}

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly externalAccess: ExternalAccessService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل الدخول' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    const ctx = deviceCtx(req);
    return this.authService.login(
      dto, ctx.ipAddress, ctx.userAgent, ctx.deviceMac, ctx.deviceHost, ctx.deviceId,
    );
  }

  @Public()
  @Post('request-device-approval')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'طلب اعتماد جهاز جديد من مدير النظام' })
  async requestDeviceApproval(@Body() dto: RequestDeviceApprovalDto, @Req() req: Request) {
    return this.authService.requestDeviceApproval(dto.username, dto.password, dto.reason, deviceCtx(req));
  }

  // ===== الدخول الخارجي (من خارج شبكة المؤسسة) =====

  @Public()
  @Post('external/request-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إرسال رمز تحقّق على بريد المستخدم للدخول الخارجي' })
  async externalRequestCode(@Body() dto: RequestExternalCodeDto) {
    return this.externalAccess.requestCode(dto.username, dto.password);
  }

  @Public()
  @Post('external/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تقديم طلب دخول خارجي (اسم ثلاثي + رمز بريد) لمدير النظام' })
  async externalRequest(@Body() dto: SubmitExternalRequestDto, @Req() req: Request) {
    return this.externalAccess.submitRequest(
      dto.username, dto.password, dto.fullName, dto.otpCode, deviceCtx(req),
    );
  }

  @Get('external-requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'قائمة طلبات الدخول الخارجي (لمدير النظام)' })
  async listExternalRequests(@Req() req: any, @Query('status') status?: string) {
    ensureSuperAdmin(req);
    return this.externalAccess.list(status);
  }

  @Post('external-requests/:id/approve')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'الموافقة على طلب دخول خارجي (مدة بالساعات أو مفتوحة)' })
  async approveExternal(@Param('id') id: string, @Body() body: { hours?: number }, @Req() req: any) {
    ensureSuperAdmin(req);
    return this.externalAccess.approve(id, BigInt(req.user.id), { hours: body?.hours });
  }

  @Post('external-requests/:id/deny')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'رفض طلب دخول خارجي (لمدير النظام)' })
  async denyExternal(@Param('id') id: string, @Req() req: any) {
    ensureSuperAdmin(req);
    return this.externalAccess.deny(id, BigInt(req.user.id));
  }

  @Post('external-lock')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'قفل/فتح الدخول الخارجي لمستخدم (لمدير النظام)' })
  async externalLock(@Body() dto: ExternalLockDto, @Req() req: any) {
    ensureSuperAdmin(req);
    return this.externalAccess.setLock(dto.userId, !!dto.locked);
  }

  @Get('device-approvals')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'قائمة طلبات اعتماد الأجهزة (لمدير النظام)' })
  async listDeviceApprovals(@Req() req: any, @Query('status') status?: string) {
    ensureSuperAdmin(req);
    return this.authService.listDeviceApprovals(status);
  }

  @Post('device-approvals/:id/approve')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'الموافقة على جهاز (لمدير النظام)' })
  async approveDevice(@Param('id') id: string, @Req() req: any) {
    ensureSuperAdmin(req);
    return this.authService.decideDevice(id, req.user.id, true, deviceCtx(req));
  }

  @Post('device-approvals/:id/reject')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'رفض جهاز (لمدير النظام)' })
  async rejectDevice(@Param('id') id: string, @Req() req: any) {
    ensureSuperAdmin(req);
    return this.authService.decideDevice(id, req.user.id, false, deviceCtx(req));
  }
}
