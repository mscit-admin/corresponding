import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { MailService } from './mail.service';
import { OtpController } from './otp.controller';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [AccessModule],
  controllers: [OtpController],
  providers: [OtpService, MailService],
  exports: [OtpService],
})
export class OtpModule {}
