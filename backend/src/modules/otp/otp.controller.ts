import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString } from 'class-validator';
import { OtpService } from './otp.service';
import { AccessService } from '../access/access.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

export class RequestOtpDto {
  @IsOptional()
  @IsString()
  purpose?: string;
}

@ApiTags('OTP')
@ApiBearerAuth()
@Controller({ path: 'otp', version: '1' })
export class OtpController {
  constructor(
    private readonly otp: OtpService,
    private readonly access: AccessService,
  ) {}

  @Get('method')
  @ApiOperation({ summary: 'طريقة تحقّق الاعتماد المُفعّلة (face/email/both)' })
  async method() {
    const cfg = await this.access.getConfig();
    return { method: cfg.approvalVerifyMethod };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('request')
  @ApiOperation({ summary: 'إرسال رمز تحقّق على بريد المستخدم' })
  async request(@CurrentUser() user: AuthUser, @Body() dto: RequestOtpDto) {
    return this.otp.requestCode(user.id, dto.purpose || 'approve');
  }
}
