import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  IsObject,
  IsEnum,
  IsUUID,
  MinLength,
  MaxLength,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class WeightCategoryDto {
  @ApiProperty({ example: 'до 70 кг' })
  @IsString()
  name: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  minWeight?: number;

  @ApiProperty({ example: 70, required: false })
  @IsOptional()
  @IsNumber()
  maxWeight?: number;

  @ApiProperty({
    example: 1,
    required: false,
    description:
      'Weight tolerance in kg. An athlete is allowed in this category as long ' +
      'as their weight ≤ maxWeight + weightToleranceKg. Default 0 (strict).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightToleranceKg?: number;

  @ApiProperty({ example: 'male', required: false })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateTournamentDto {
  @ApiProperty({ example: 'sport-uuid-here' })
  @IsUUID()
  sportId: string;

  @ApiProperty({ example: 'Armenia Open 2025' })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  name: string;

  @ApiProperty({ example: 'Армения Опен 2025', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameRu?: string;

  @ApiProperty({ example: 'Armenia Open 2025', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameEn?: string;

  @ApiProperty({ example: 'Հայաստան Օփն 2025', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameHy?: string;

  @ApiProperty({ example: '2025-06-01T10:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: 'Yerevan', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: 'Armenia', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'Yerevan', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    enum: ['single_elimination', 'double_elimination', 'round_robin'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['single_elimination', 'double_elimination', 'round_robin'])
  format?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descriptionHy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ type: [WeightCategoryDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeightCategoryDto)
  weightCategories?: WeightCategoryDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  sportConfig?: Record<string, unknown>;
}
