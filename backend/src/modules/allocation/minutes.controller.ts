import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllocationService } from './allocation.service';
import { CreateMinutesDto } from './dto/workflow.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Allocation Committee')
@ApiBearerAuth()
@Controller({ path: 'allocation/minutes', version: '1' })
export class MinutesController {
  constructor(private readonly service: AllocationService) {}

  @Get()
  @ApiOperation({ summary: 'قائمة محاضر اللجنة' })
  list() {
    return this.service.listMinutes();
  }

  @Post()
  @ApiOperation({ summary: 'إنشاء محضر لجنة جديد' })
  create(@Body() dto: CreateMinutesDto, @CurrentUser() user: AuthUser) {
    return this.service.createMinutes(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل المحضر مع الطلبات المدرجة' })
  get(@Param('id') id: string) {
    return this.service.getMinutes(id);
  }

  @Post(':id/cabinet-approve')
  @ApiOperation({ summary: 'اعتماد المحضر من مجلس الوزراء وحسم الطلبات' })
  cabinetApprove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.cabinetApproveMinutes(id, user);
  }
}
