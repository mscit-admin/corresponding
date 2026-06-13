import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsNumberString } from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateIncomingDto {
  @ApiProperty({ description: 'تاريخ ووقت الاستلام', example: '2026-05-18T10:23:00Z' })
  @IsDateString()
  receivedAt: string;

  @ApiProperty({ description: 'معرف الجهة المرسلة', example: '12' })
  @IsNumberString()
  senderEntityId: string;

  @ApiPropertyOptional({ description: 'رقم المرجع لدى المرسل', example: 'MOF-2026-1247' })
  @IsOptional()
  @IsString()
  senderRefNo?: string;

  @ApiPropertyOptional({ description: 'تاريخ المراسلة الأصلي', example: '2026-05-17' })
  @IsOptional()
  @IsDateString()
  originalDate?: string;

  @ApiProperty({ description: 'موضوع المراسلة' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({ enum: Priority, default: Priority.normal })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority = Priority.normal;

  @ApiPropertyOptional({ description: 'معرف التصنيف' })
  @IsOptional()
  @IsNumberString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'معرف المستخدم المحول إليه' })
  @IsOptional()
  @IsNumberString()
  currentOwnerId?: string;

  @ApiPropertyOptional({ description: 'الموعد النهائي للإجراء' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
