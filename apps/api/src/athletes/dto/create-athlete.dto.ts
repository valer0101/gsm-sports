import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsObject,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateAthleteDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  sportId: number;

  @ApiProperty({ example: 'user-uuid', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ example: 'Armen' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Harutyunyan' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'Armenia', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'Yerevan', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: '1995-03-15', required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ enum: ['male', 'female'], required: false })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @ApiProperty({ enum: ['left', 'right', 'both'], required: false })
  @IsOptional()
  @IsEnum(['left', 'right', 'both'])
  primaryHand?: string;

  @ApiProperty({ example: 70.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(300)
  weight?: number;

  @ApiProperty({ example: 175, required: false })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(250)
  height?: number;

  @ApiProperty({ enum: ['beginner', 'intermediate', 'advanced', 'professional'], required: false })
  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced', 'professional'])
  experienceLevel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bioRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bioEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bioHy?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  achievements?: Record<string, unknown>;
}
