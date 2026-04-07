import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiProperty({ example: 'Armen' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Hakobyan' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'Armenia', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: '+37491234567', required: false })
  @IsOptional()
  @Matches(/^\+?[\d\s\-()]{7,20}$/, { message: 'Invalid phone number format' })
  phone?: string;

  @ApiProperty({ example: '1995-06-15', required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ example: 'hy', required: false })
  @IsOptional()
  @IsString()
  language?: string;
}
