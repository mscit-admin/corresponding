import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsDateString, IsNumberString, Matches } from 'class-validator';
import { Priority, Confidentiality, Visibility } from '@prisma/client';

export class CreateIncomingDto {
  @ApiProperty({ description: 'تاريخ ووقت الاستلام', example: '2026-05-18T10:23:00Z' })
  @IsDateString()
  receivedAt: string;

  @ApiPropertyOptional({ description: 'رقم القيد', example: '2026/145' })
  @IsOptional()
  @IsString()
  registryNo?: string;

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

  @ApiPropertyOptional({ description: 'نوع المعاملة', example: 'كتاب رسمي' })
  @IsOptional()
  @IsString()
  transactionType?: string;

  @ApiPropertyOptional({ enum: Priority, default: Priority.normal, description: 'درجة الأهمية' })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority = Priority.normal;

  @ApiPropertyOptional({ enum: Confidentiality, default: Confidentiality.normal, description: 'درجة السرية' })
  @IsOptional()
  @IsEnum(Confidentiality)
  confidentiality?: Confidentiality = Confidentiality.normal;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.public, description: 'صلاحية المشاهدة' })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility = Visibility.public;

  @ApiPropertyOptional({ description: 'معرّفات الإدارات المسموح لها بالمشاهدة', type: [String] })
  @IsOptional()
  @IsArray()
  @IsNumberString({}, { each: true })
  visibilityDeptIds?: string[];

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
