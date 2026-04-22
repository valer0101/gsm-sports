import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
  IsUUID,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class ReassignEntryDto {
  @ApiProperty({ required: false, description: 'New weight category id' })
  @IsOptional()
  @IsUUID()
  weightCategoryId?: string | null;

  @ApiProperty({ required: false, enum: ['juniors', 'adults', 'veterans'] })
  @IsOptional()
  @IsIn(['juniors', 'adults', 'veterans'])
  ageGroup?: 'juniors' | 'adults' | 'veterans';

  @ApiProperty({ required: false, enum: ['left', 'right'] })
  @IsOptional()
  @IsIn(['left', 'right'])
  hand?: 'left' | 'right';

  @ApiProperty({ required: false, description: 'Corrected weight in kg' })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(300)
  weightKg?: number;

  @ApiProperty({ description: 'Reason for the change (audited)' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
