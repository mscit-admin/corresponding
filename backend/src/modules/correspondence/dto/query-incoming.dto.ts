import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'البحث في الموضوع والرقم التسلسلي' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'مراسلات المستخدم الحالي فقط' })
  @IsOptional()
  @Type(() => Boolean)
  myInbox?: boolean = false;
}
