import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'بيانات المستخدم الحالي' })
  async me(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'قائمة المستخدمين' })
  async findAll(
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.usersService.findAll({
      skip,
      take,
      departmentId: departmentId ? BigInt(departmentId) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'بيانات مستخدم معين' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(BigInt(id));
  }
}
