import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({ enum: ['draft', 'upcoming', 'active', 'completed', 'cancelled'] })
  @IsEnum(['draft', 'upcoming', 'active', 'completed', 'cancelled'])
  status: string;
}
