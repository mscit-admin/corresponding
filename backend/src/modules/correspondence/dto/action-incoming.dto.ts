import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** جسم إجراءات إدارة المعاملة (اعتماد/رفض/إعادة/ملاحظة/طباعة/إغلاق/أرشفة). */
export class ActionDto {
  @ApiPropertyOptional({ description: 'ملاحظة/سبب الإجراء (إلزامي للرفض والإعادة وإضافة ملاحظة)' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
