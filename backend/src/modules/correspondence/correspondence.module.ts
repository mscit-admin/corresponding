import { Module } from '@nestjs/common';
import { IncomingService } from './incoming.service';
import { IncomingController } from './incoming.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [IncomingController],
  providers: [IncomingService],
  exports: [IncomingService],
})
export class CorrespondenceModule {}
