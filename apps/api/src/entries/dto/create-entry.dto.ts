import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsEnum, IsUUID, IsString, Min, Max } from 'class-validator';

export class CreateEntryDto {
  @ApiProperty({ example: 'tournament-uuid-here' })
  @IsUUID()
  tournamentId: string;

  @ApiProperty({ example: 'weight-category-uuid', required: false })
  @IsOptional()
  @IsUUID()
  weightCategoryId?: string;

  @ApiProperty({ enum: ['left', 'right', 'both'], required: false })
  @IsOptional()
  @IsEnum(['left', 'right', 'both'])
  hand?: string;

  @ApiProperty({ example: 68.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(300)
  registeredWeight?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
