import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateRequestDto {
  @ApiProperty({ description: 'تاريخ استلام الطلب', example: '2026-06-16T09:00:00Z' })
  @IsDateString()
  receivedAt: string;

  @ApiPropertyOptional({ description: 'رقم الأسبقية', example: '145' })
  @IsOptional()
  @IsNumberString()
  priorityNo?: string;

  @ApiProperty({ description: 'معرف المكتب المختص / الجهة طالبة التخصيص', example: '2' })
  @IsNumberString()
  requestingOfficeId: string;

  @ApiPropertyOptional({ description: 'الجهة المستفيدة من التخصيص' })
  @IsOptional()
  @IsString()
  beneficiary?: string;

  @ApiProperty({ description: 'موضوع الطلب' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({ description: 'الغرض من التخصيص' })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ description: 'وصف الموقع' })
  @IsOptional()
  @IsString()
  locationDesc?: string;

  @ApiPropertyOptional({ description: 'المساحة', example: '5000 م²' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ description: 'الموقع خارج المخطط العمراني', default: false })
  @IsOptional()
  @IsBoolean()
  isOutsidePlan?: boolean;

  @ApiPropertyOptional({ enum: Priority, default: Priority.normal })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority = Priority.normal;

  @ApiPropertyOptional({ description: 'معرف المراسلة الواردة المرتبطة' })
  @IsOptional()
  @IsNumberString()
  incomingId?: string;
}
