import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsArray } from 'class-validator';
import { FaceService } from './face.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

export class FaceDescriptorDto {
  @IsArray()
  descriptor: number[];
}

@ApiTags('Face')
@ApiBearerAuth()
@Controller({ path: 'face', version: '1' })
export class FaceController {
  constructor(private readonly face: FaceService) {}

  @Get('status')
  @ApiOperation({ summary: 'حالة تسجيل بصمة الوجه للمستخدم الحالي' })
  status(@CurrentUser() user: AuthUser) {
    return this.face.status(user.id);
  }

  @Post('enroll')
  @ApiOperation({ summary: 'تسجيل/تحديث بصمة وجه المستخدم الحالي' })
  enroll(@CurrentUser() user: AuthUser, @Body() dto: FaceDescriptorDto) {
    return this.face.enroll(user.id, dto.descriptor);
  }

  @Delete('enroll')
  @ApiOperation({ summary: 'حذف بصمة وجه المستخدم الحالي' })
  reset(@CurrentUser() user: AuthUser) {
    return this.face.reset(user.id);
  }

  @Post('verify')
  @ApiOperation({ summary: 'التحقّق من بصمة وجه المستخدم الحالي' })
  verify(@CurrentUser() user: AuthUser, @Body() dto: FaceDescriptorDto) {
    return this.face.verify(user.id, dto.descriptor);
  }
}
