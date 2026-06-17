import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'تنبيهات المستخدم الحالي' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('unread') unread?: string,
    @Query('take') take?: string,
  ) {
    return this.service.list(user.id, {
      unreadOnly: unread === 'true' || unread === '1',
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'عدد التنبيهات غير المقروءة' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'تعليم كل التنبيهات كمقروءة' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'تعليم تنبيه كمقروء' })
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.markRead(id, user.id);
  }
}
