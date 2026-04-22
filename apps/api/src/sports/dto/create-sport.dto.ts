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

export class CreateSportDto {
  @ApiProperty({ example: 'armwrestling' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  slug: string;

  @ApiProperty({ example: 'Армрестлинг' })
  @IsString()
  nameRu: string;

  @ApiProperty({ example: 'Armwrestling' })
  @IsString()
  nameEn: string;

  @ApiProperty({ example: 'Ձեռնամարտ' })
  @IsString()
  nameHy: string;

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
