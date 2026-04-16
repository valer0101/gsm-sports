import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateNewsDto {
  @ApiProperty({ example: 'GSM открывает сезон 2026' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: '<p>Текст статьи...</p>' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ example: 'Краткое описание статьи' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiProperty({ example: 'news', enum: ['news', 'business', 'sport'] })
  @IsIn(['news', 'business', 'sport'])
  category: string;

  @ApiProperty({ example: 'draft', enum: ['draft', 'published'] })
  @IsIn(['draft', 'published'])
  status: string;
}
