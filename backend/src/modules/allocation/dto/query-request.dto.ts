import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AllocationStatus, Priority } from '@prisma/client';

export class QueryRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  skip?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  take?: number = 50;

  @ApiPropertyOptional({ enum: AllocationStatus })
  @IsOptional()
  @IsEnum(AllocationStatus)
  status?: AllocationStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: 'تصفية حسب المحضر' })
  @IsOptional()
  @IsNumberString()
  minutesId?: string;

  @ApiPropertyOptional({ description: 'بحث في الموضوع والرقم التسلسلي' })
  @IsOptional()
  @IsString()
  search?: string;
}
