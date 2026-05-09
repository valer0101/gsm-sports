import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPasswordDto {
  @ApiProperty({
    example: 'OldSecret123',
    required: false,
    description:
      'Current password — required only if the user already has one set. ' +
      'Google-only accounts can omit this on first set.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  currentPassword?: string;

  @ApiProperty({ example: 'NewSecret123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}
