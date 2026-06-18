import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { IncomingService } from './incoming.service';
import { CreateIncomingDto } from './dto/create-incoming.dto';
import { UpdateIncomingDto } from './dto/update-incoming.dto';
import { RouteIncomingDto } from './dto/route-incoming.dto';
import { ActionDto } from './dto/action-incoming.dto';
import { QueryIncomingDto } from './dto/query-incoming.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Incoming Correspondence')
@ApiBearerAuth()
@Controller({ path: 'correspondence/incoming', version: '1' })
export class IncomingController {
  constructor(private readonly incomingService: IncomingService) {}

  @Post()
  @ApiOperation({ summary: 'تسجيل وارد جديد' })
  async create(
    @Body() dto: CreateIncomingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '0.0.0.0';
    return this.incomingService.create(dto, user, ip);
  }

  @Get()
  @ApiOperation({ summary: 'قائمة المراسلات الواردة' })
  async findAll(@Query() query: QueryIncomingDto, @CurrentUser() user: AuthUser) {
    return this.incomingService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل مراسلة واردة' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '0.0.0.0';
    return this.incomingService.findById(BigInt(id), user, ip, req.headers['user-agent']);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل مراسلة واردة (يتطلب صلاحية التعديل)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIncomingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '0.0.0.0';
    return this.incomingService.update(BigInt(id), dto, user, ip, 'UPDATE', req.headers['user-agent']);
  }

  @Get(':id/audit')
  @ApiOperation({ summary: 'سجلّ التعديلات التفصيلي للمراسلة (لمدير النظام)' })
  async audit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.incomingService.getAuditLog(BigInt(id), user);
  }

  @Post(':id/audit/:auditId/restore')
  @ApiOperation({ summary: 'الرجوع لبيانات سابقة من سجلّ التعديلات (لمدير النظام)' })
  async restore(
    @Param('id') id: string,
    @Param('auditId') auditId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '0.0.0.0';
    return this.incomingService.restoreAudit(BigInt(id), BigInt(auditId), user, ip, req.headers['user-agent']);
  }

  @Post(':id/route')
  @ApiOperation({ summary: 'توجيه/تهميش مراسلة إلى إدارات (للمدير)' })
  async route(
    @Param('id') id: string,
    @Body() dto: RouteIncomingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.incomingService.route(BigInt(id), dto, user);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'اعتماد المعاملة (للمدير)' })
  async approve(@Param('id') id: string, @Body() dto: ActionDto, @CurrentUser() user: AuthUser) {
    return this.incomingService.act(BigInt(id), 'approve', dto, user);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'رفض المعاملة (للمدير) — يتطلب سبباً' })
  async reject(@Param('id') id: string, @Body() dto: ActionDto, @CurrentUser() user: AuthUser) {
    return this.incomingService.act(BigInt(id), 'reject', dto, user);
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'إعادة المعاملة — يتطلب ملاحظة' })
  async returnAction(@Param('id') id: string, @Body() dto: ActionDto, @CurrentUser() user: AuthUser) {
    return this.incomingService.act(BigInt(id), 'return', dto, user);
  }

  @Post(':id/note')
  @ApiOperation({ summary: 'إضافة ملاحظة على المعاملة' })
  async note(@Param('id') id: string, @Body() dto: ActionDto, @CurrentUser() user: AuthUser) {
    return this.incomingService.act(BigInt(id), 'note', dto, user);
  }

  @Post(':id/print')
  @ApiOperation({ summary: 'تسجيل طباعة المعاملة' })
  async print(@Param('id') id: string, @Body() dto: ActionDto, @CurrentUser() user: AuthUser) {
    return this.incomingService.act(BigInt(id), 'print', dto, user);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'إغلاق المعاملة (للمدير)' })
  async close(@Param('id') id: string, @Body() dto: ActionDto, @CurrentUser() user: AuthUser) {
    return this.incomingService.act(BigInt(id), 'close', dto, user);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'أرشفة المعاملة (للمدير)' })
  async archive(@Param('id') id: string, @Body() dto: ActionDto, @CurrentUser() user: AuthUser) {
    return this.incomingService.act(BigInt(id), 'archive', dto, user);
  }
}
