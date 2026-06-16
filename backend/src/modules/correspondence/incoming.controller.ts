import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { IncomingService } from './incoming.service';
import { CreateIncomingDto } from './dto/create-incoming.dto';
import { UpdateIncomingDto } from './dto/update-incoming.dto';
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
    return this.incomingService.create(dto, user.id, ip);
  }

  @Get()
  @ApiOperation({ summary: 'قائمة المراسلات الواردة' })
  async findAll(@Query() query: QueryIncomingDto, @CurrentUser() user: AuthUser) {
    return this.incomingService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل مراسلة واردة' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.incomingService.findById(BigInt(id), user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'تعديل مراسلة واردة (يتطلب صلاحية التعديل)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIncomingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.incomingService.update(BigInt(id), dto, user);
  }
}
