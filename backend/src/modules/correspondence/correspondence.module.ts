import { Module } from '@nestjs/common';
import { IncomingService } from './incoming.service';
import { IncomingRemindersService } from './incoming-reminders.service';
import { IncomingController } from './incoming.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { FaceModule } from '../face/face.module';
import { OtpModule } from '../otp/otp.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [NotificationsModule, FaceModule, OtpModule, AccessModule],
  controllers: [IncomingController],
  providers: [IncomingService, IncomingRemindersService],
  exports: [IncomingService],
})
export class CorrespondenceModule {}
