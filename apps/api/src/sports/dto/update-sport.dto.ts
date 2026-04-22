import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SportConfigDto } from './sport-config.dto';

export class UpdateSportDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  slug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nameRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nameHy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iconUrl?: string;

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
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ type: SportConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => SportConfigDto)
  config?: SportConfigDto;
}
