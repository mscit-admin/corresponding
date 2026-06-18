import { Controller, Get, Query, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LogsService, LogQuery } from './logs.service';

function ensureSuperAdmin(req: any) {
  if (req.user?.role?.name !== 'super_admin') {
    throw new ForbiddenException('هذه السجلّات متاحة لمدير النظام فقط');
  }
}

@ApiTags('Logs')
@ApiBearerAuth()
@Controller({ path: 'logs', version: '1' })
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get('audit')
  @ApiOperation({ summary: 'سجلّ التعديلات العام (لمدير النظام)' })
  audit(@Req() req: any, @Query() q: LogQuery) {
    ensureSuperAdmin(req);
    return this.logs.list('audit', q);
  }

  @Get('access')
  @ApiOperation({ summary: 'سجلّ الوصول والدخول (لمدير النظام)' })
  access(@Req() req: any, @Query() q: LogQuery) {
    ensureSuperAdmin(req);
    return this.logs.list('access', q);
  }
}
