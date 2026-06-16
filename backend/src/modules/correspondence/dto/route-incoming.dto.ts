import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumberString, IsOptional, IsString } from 'class-validator';

export class RouteIncomingDto {
  @ApiProperty({ description: 'معرّفات الإدارات الموجَّه إليها', type: [String] })
  @IsArray()
  @IsNumberString({}, { each: true })
  departmentIds: string[];

  @ApiPropertyOptional({ description: 'التهميش / ملاحظة التوجيه' })
  @IsOptional()
  @IsString()
  note?: string;
}
