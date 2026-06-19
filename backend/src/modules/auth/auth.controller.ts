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
import { LoginDto, LoginResponseDto, RequestDeviceApprovalDto } from './dto/login.dto';
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
  constructor(private readonly authService: AuthService) {}

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
