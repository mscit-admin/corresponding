import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AllocationDocStatus, AllocationDocType } from '@prisma/client';

export class CommitteeDecisionDto {
  @ApiProperty({ enum: ['approve', 'reject'], description: 'قرار اللجنة' })
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'ملاحظات/توصية اللجنة' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class NotesDto {
  @ApiPropertyOptional({ description: 'ملاحظات' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignMinutesDto {
  @ApiProperty({ description: 'معرف المحضر' })
  @IsNumberString()
  minutesId: string;

  @ApiProperty({ description: 'الرقم داخل المحضر (1 إلى 12)', example: 1 })
  @IsInt()
  @Min(1)
  @Max(12)
  itemNo: number;
}

export class DecisionDto {
  @ApiPropertyOptional({ description: 'رقم قرار التخصيص' })
  @IsOptional()
  @IsString()
  decisionNo?: string;

  @ApiPropertyOptional({ description: 'تاريخ القرار' })
  @IsOptional()
  @IsDateString()
  decisionDate?: string;
}

export class UpsertDocumentDto {
  @ApiProperty({ enum: AllocationDocType })
  @IsEnum(AllocationDocType)
  docType: AllocationDocType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ enum: AllocationDocStatus })
  @IsOptional()
  @IsEnum(AllocationDocStatus)
  status?: AllocationDocStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ enum: AllocationDocStatus })
  @IsOptional()
  @IsEnum(AllocationDocStatus)
  status?: AllocationDocStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateMinutesDto {
  @ApiProperty({ description: 'رقم المحضر', example: 'محضر 2026/3' })
  @IsString()
  @IsNotEmpty()
  minutesNo: string;

  @ApiProperty({ description: 'تاريخ اجتماع اللجنة' })
  @IsDateString()
  meetingDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
