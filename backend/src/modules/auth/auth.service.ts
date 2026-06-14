import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress: string, userAgent?: string): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: {
        role: true,
        department: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('الحساب معطل، يرجى التواصل مع مدير النظام');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      // Audit failed login attempt (fire-and-forget — don't delay the response)
      void this.prisma.auditLog
        .create({
          data: {
            userId: user.id,
            action: 'LOGIN_FAILED',
            entityType: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
          },
        })
        .catch((e) => this.logger.warn(`Audit (LOGIN_FAILED) failed: ${e.message}`));
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    // Update last login + audit success in the background so the response is
    // not delayed by extra DB round-trips.
    void this.prisma.user
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch((e) => this.logger.warn(`lastLoginAt update failed: ${e.message}`));

    void this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: 'LOGIN_SUCCESS',
          entityType: 'User',
          entityId: user.id,
          ipAddress,
          userAgent,
        },
      })
      .catch((e) => this.logger.warn(`Audit (LOGIN_SUCCESS) failed: ${e.message}`));

    const accessToken = await this.jwt.signAsync({
      sub: user.id.toString(),
      username: user.username,
    });

    return {
      accessToken,
      user: {
        id: user.id.toString(),
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role.nameAr,
        roleName: user.role.name,
        department: user.department.name,
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    const rounds = this.config.get<number>('security.bcryptRounds') || 12;
    return bcrypt.hash(password, rounds);
  }
}
