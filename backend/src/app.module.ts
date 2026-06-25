import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CorrespondenceModule } from './modules/correspondence/correspondence.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModule } from './modules/ai/ai.module';
import { LogsModule } from './modules/logs/logs.module';
import { AccessModule } from './modules/access/access.module';
import { FaceModule } from './modules/face/face.module';
import { OtpModule } from './modules/otp/otp.module';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-proxy.guard';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: (parseInt(process.env.RATE_LIMIT_TTL || '60', 10)) * 1000,
          limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        },
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CorrespondenceModule,
    AttachmentsModule,
    ReferenceModule,
    NotificationsModule,
    AiModule,
    LogsModule,
    AccessModule,
    FaceModule,
    OtpModule,
  ],
  providers: [
    // تحديد المعدّل عالمياً (مع حساب العميل الحقيقي خلف البروكسي)
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
  ],
})
export class AppModule {}
