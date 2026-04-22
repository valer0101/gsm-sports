import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { TableStatus } from '@gsm/shared-types';

export class CreateTableDto {
  @ApiProperty({ example: 1, description: 'Table number — unique per tournament' })
  @IsInt()
  @Min(1)
  number: number;

  @ApiProperty({ example: 'Main table', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ enum: ['idle', 'busy', 'offline'], required: false, default: 'idle' })
  @IsOptional()
  @IsEnum(['idle', 'busy', 'offline'])
  status?: TableStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
