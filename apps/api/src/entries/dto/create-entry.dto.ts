import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsEnum, IsUUID, IsString, Min, Max } from 'class-validator';
import { AgeGroup } from '../entities/tournament-entry.entity';

export class CreateEntryDto {
  @ApiProperty({ example: 'tournament-uuid-here' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ enum: ['juniors', 'adults', 'veterans'] })
  @IsEnum(['juniors', 'adults', 'veterans'])
  ageGroup: AgeGroup;

  @ApiProperty({ enum: ['left', 'right'] })
  @IsEnum(['left', 'right'])
  hand: string;

  @ApiProperty({ example: 68.5, description: 'Participant weight in kg' })
  @IsNumber()
  @Min(20)
  @Max(300)
  weightKg: number;

  @ApiProperty({ example: 'weight-category-uuid', required: false })
  @IsOptional()
  @IsUUID()
  weightCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
