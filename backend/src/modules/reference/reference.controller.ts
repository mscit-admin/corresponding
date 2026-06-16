import { Body, Controller, ForbiddenException, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReferenceService } from './reference.service';

const EDIT_ROLES = ['super_admin', 'archive_mgr', 'diwan_officer'];

function ensureCanManage(req: any) {
  const roleName = req.user?.role?.name;
  if (!EDIT_ROLES.includes(roleName)) {
    throw new ForbiddenException('ليس لديك صلاحية إضافة بيانات مرجعية');
  }
}

@ApiTags('Reference Data')
@ApiBearerAuth()
@Controller({ version: '1' })
export class ReferenceController {
  constructor(private readonly service: ReferenceService) {}

  @Get('entities')
  @ApiOperation({ summary: 'قائمة الجهات الخارجية' })
  entities() {
    return this.service.entities();
  }

  @Post('entities')
  @ApiOperation({ summary: 'إضافة جهة خارجية (يتطلب صلاحية)' })
  createEntity(@Body() body: any, @Req() req: any) {
    ensureCanManage(req);
    return this.service.createEntity(body);
  }

  @Get('departments')
  @ApiOperation({ summary: 'قائمة الإدارات الداخلية' })
  departments() {
    return this.service.departments();
  }

  @Post('departments')
  @ApiOperation({ summary: 'إضافة إدارة داخلية (يتطلب صلاحية)' })
  createDepartment(@Body() body: any, @Req() req: any) {
    ensureCanManage(req);
    return this.service.createDepartment(body);
  }
}
