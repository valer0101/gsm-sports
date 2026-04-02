import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  IsObject,
  IsEnum,
  MinLength,
  MaxLength,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class UpdateWeightCategoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  minWeight?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxWeight?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateTournamentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameHy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ enum: ['single_elimination', 'double_elimination', 'round_robin'], required: false })
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  posterUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  streamUrl?: string;

  @ApiProperty({ type: [UpdateWeightCategoryDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateWeightCategoryDto)
  weightCategories?: UpdateWeightCategoryDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  sportConfig?: Record<string, unknown>;
}
