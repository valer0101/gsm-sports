import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Hex token from the email link', example: 'a'.repeat(64) })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Invalid reset token format' })
  token: string;

  @ApiProperty({ example: 'NewSecurePass123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}
