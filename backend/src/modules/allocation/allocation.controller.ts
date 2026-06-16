import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllocationService } from './allocation.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { QueryRequestDto } from './dto/query-request.dto';
import {
  AssignMinutesDto,
  CommitteeDecisionDto,
  DecisionDto,
  NotesDto,
  UpdateDocumentDto,
  UpsertDocumentDto,
} from './dto/workflow.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Allocation Committee')
@ApiBearerAuth()
@Controller({ path: 'allocation/requests', version: '1' })
export class AllocationController {
  constructor(private readonly service: AllocationService) {}

  @Post()
  @ApiOperation({ summary: 'تسجيل طلب تخصيص جديد' })
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.createRequest(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'قائمة طلبات التخصيص (مع الفلاتر)' })
  findAll(@Query() query: QueryRequestDto) {
    return this.service.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'إحصائيات الطلبات حسب الحالة' })
  stats() {
    return this.service.stats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل طلب تخصيص' })
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل بيانات الطلب' })
  update(@Param('id') id: string, @Body() dto: UpdateRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.updateRequest(id, dto, user);
  }

  // ---- Workflow ----

  @Post(':id/submit')
  @ApiOperation({ summary: 'عرض الطلب على اللجنة للدراسة' })
  submit(@Param('id') id: string, @Body() dto: NotesDto, @CurrentUser() user: AuthUser) {
    return this.service.submitToCommittee(id, user, dto.notes);
  }

  @Post(':id/missing')
  @ApiOperation({ summary: 'تسجيل نواقص ومراسلة المكتب المختص' })
  missing(@Param('id') id: string, @Body() dto: NotesDto, @CurrentUser() user: AuthUser) {
    return this.service.markMissing(id, user, dto.notes);
  }

  @Post(':id/committee-decision')
  @ApiOperation({ summary: 'قرار اللجنة (موافقة/عدم موافقة)' })
  decision(@Param('id') id: string, @Body() dto: CommitteeDecisionDto, @CurrentUser() user: AuthUser) {
    return this.service.committeeDecision(id, user, dto.decision, dto.notes);
  }

  @Post(':id/assign-minutes')
  @ApiOperation({ summary: 'إدراج الطلب في محضر اللجنة' })
  assignMinutes(@Param('id') id: string, @Body() dto: AssignMinutesDto, @CurrentUser() user: AuthUser) {
    return this.service.assignToMinutes(id, user, dto.minutesId, dto.itemNo);
  }

  @Post(':id/decision')
  @ApiOperation({ summary: 'تسجيل رقم وتاريخ قرار التخصيص' })
  recordDecision(@Param('id') id: string, @Body() dto: DecisionDto, @CurrentUser() user: AuthUser) {
    return this.service.recordDecision(id, user, dto.decisionNo, dto.decisionDate);
  }

  // ---- Documents checklist ----

  @Post(':id/documents')
  @ApiOperation({ summary: 'إضافة مستند للقائمة' })
  addDocument(@Param('id') id: string, @Body() dto: UpsertDocumentDto, @CurrentUser() user: AuthUser) {
    return this.service.upsertDocument(id, user, dto);
  }

  @Patch(':id/documents/:docId')
  @ApiOperation({ summary: 'تحديث حالة/ملاحظات مستند' })
  updateDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateDocument(id, docId, user, dto);
  }
}
