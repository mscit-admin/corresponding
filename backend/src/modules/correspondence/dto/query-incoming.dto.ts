import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsBooleanString } from 'class-validator';
import { Type } from 'class-transformer';
import { IncomingStatus, Priority } from '@prisma/client';

export class QueryIncomingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  skip?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  take?: number = 20;

  @ApiPropertyOptional({ enum: IncomingStatus })
  @IsOptional()
  @IsEnum(IncomingStatus)
  status?: IncomingStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: 'بحث عام في الموضوع والأرقام والجهة' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'مراسلات المستخدم الحالي فقط' })
  @IsOptional()
  @Type(() => Boolean)
  myInbox?: boolean = false;

  // ===== البحث المتقدّم =====

  @ApiPropertyOptional({ description: 'رقم المعاملة (التسلسلي/القيد/المرجع)' })
  @IsOptional()
  @IsString()
  serialNo?: string;

  @ApiPropertyOptional({ description: 'الموضوع' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'معرّف الجهة المُرسِلة' })
  @IsOptional()
  @IsString()
  senderEntityId?: string;

  @ApiPropertyOptional({ description: 'المستخدم (اسم أو رقم وظيفي للمُسجِّل)' })
  @IsOptional()
  @IsString()
  userQuery?: string;

  @ApiPropertyOptional({ description: 'نوع المعاملة' })
  @IsOptional()
  @IsString()
  transactionType?: string;

  @ApiPropertyOptional({ description: 'من تاريخ (وارد) — YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'إلى تاريخ (وارد) — YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'يحتوي مرفقات فقط' })
  @IsOptional()
  @IsBooleanString()
  hasAttachments?: string;

  @ApiPropertyOptional({ description: 'اسم ملف المرفق' })
  @IsOptional()
  @IsString()
  attachmentName?: string;

  @ApiPropertyOptional({ description: 'بحث داخل محتوى الوثائق (OCR)' })
  @IsOptional()
  @IsString()
  ocr?: string;
}
