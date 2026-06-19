import { Body, Controller, ForbiddenException, Get, Patch, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AccessService, AccessConfig } from './access.service';

function ensureSuperAdmin(req: any) {
  if (req.user?.role?.name !== 'super_admin') {
    throw new ForbiddenException('هذه الإعدادات متاحة لمدير النظام فقط');
  }
}

function reqIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '0.0.0.0';
}

@ApiTags('Access')
@ApiBearerAuth()
@Controller({ path: 'access', version: '1' })
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get('settings')
  @ApiOperation({ summary: 'إعدادات وقت الدوام وشبكة الشركة (لمدير النظام)' })
  async getSettings(@Req() req: any) {
    ensureSuperAdmin(req);
    return this.access.getConfig(true);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'تحديث إعدادات الوصول (لمدير النظام)' })
  async updateSettings(@Req() req: any, @Body() body: Partial<AccessConfig>) {
    ensureSuperAdmin(req);
    return this.access.updateConfig(body);
  }

  @Get('policy')
  @ApiOperation({ summary: 'سياسة الوصول للجلسة الحالية (للقفل التلقائي في الواجهة)' })
  async policy(@Req() req: any) {
    const evalResult = await this.access.evaluate(reqIp(req));
    const isSuperAdmin = req.user?.role?.name === 'super_admin';
    return { ...evalResult, exempt: isSuperAdmin };
  }
}
