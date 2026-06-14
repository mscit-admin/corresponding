import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsDateString, IsNumberString, Matches } from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateIncomingDto {
  @ApiProperty({ description: 'تاريخ ووقت الاستلام', example: '2026-05-18T10:23:00Z' })
  @IsDateString()
  receivedAt: string;

  @ApiProperty({ description: 'معرف الجهة المرسلة', example: '12' })
  @IsNumberString()
  senderEntityId: string;

  @ApiPropertyOptional({ description: 'رقم المرجع لدى المرسل (أرقام فقط)', example: '12471' })
  @IsOptional()
  @Matches(/^[0-9]*$/, { message: 'رقم المرسل يجب أن يكون أرقاماً فقط' })
  senderRefNo?: string;

  @ApiPropertyOptional({ description: 'نوع الجهة المرسل إليها', enum: ['internal', 'external'] })
  @IsOptional()
  @IsIn(['internal', 'external'])
  recipientType?: string;

  @ApiPropertyOptional({ description: 'اسم الجهة المرسل إليها', example: 'مكتب الوزير' })
  @IsOptional()
  @IsString()
  recipientName?: string;

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
