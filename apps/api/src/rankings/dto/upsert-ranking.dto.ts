import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsEnum, IsUUID, Min, Max } from 'class-validator';

export class UpsertRankingDto {
  @ApiProperty()
  @IsUUID()
  athleteId: string;

  @ApiProperty({ description: 'Sport UUID' })
  @IsUUID()
  sportId: string;

  @ApiProperty({ example: 2025 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  season: number;

  @ApiProperty({ example: 150 })
  @IsInt()
  @Min(0)
  points: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ enum: ['left', 'right'], required: false })
  @IsOptional()
  @IsEnum(['left', 'right'])
  hand?: string;

  @ApiProperty({ enum: ['male', 'female'], required: false })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  weightCategory?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
