import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { TableStatus } from '@gsm/shared-types';

export class UpdateTableDto {
  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  number?: number;

  @ApiProperty({ example: 'Main table', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;

  @ApiProperty({ enum: ['idle', 'busy', 'offline'], required: false })
  @IsOptional()
  @IsEnum(['idle', 'busy', 'offline'])
  status?: TableStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
