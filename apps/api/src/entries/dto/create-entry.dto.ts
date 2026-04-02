import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsNumber, IsEnum, Min, Max } from 'class-validator';

export class CreateEntryDto {
  @ApiProperty({ example: 'tournament-uuid-here' })
  @IsString()
  tournamentId: string;

  @ApiProperty({ example: 3, required: false })
  @IsOptional()
  @IsInt()
  weightCategoryId?: number;

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
