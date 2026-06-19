import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
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
  ],
})
export class AppModule {}
