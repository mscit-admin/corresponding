import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { IncomingStatus } from '@prisma/client';
import { CreateIncomingDto } from './create-incoming.dto';

// All create fields become optional, plus a workflow status.
export class UpdateIncomingDto extends PartialType(CreateIncomingDto) {
  @ApiPropertyOptional({ enum: IncomingStatus, description: 'حالة المراسلة' })
  @IsOptional()
  @IsEnum(IncomingStatus)
  status?: IncomingStatus;
}
