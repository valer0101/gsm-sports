import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CheckInByQrDto {
  @ApiProperty({
    description: 'Signed JWT token embedded in the athlete-facing QR code',
    example: 'eyJhbGciOi...',
  })
  @IsString()
  @MinLength(20)
  token: string;
}
