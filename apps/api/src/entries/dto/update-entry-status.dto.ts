import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EntryStatus } from '../entities/tournament-entry.entity';

export class UpdateEntryStatusDto {
  @ApiProperty({ enum: ['pending', 'confirmed', 'rejected', 'withdrawn'] })
  @IsEnum(['pending', 'confirmed', 'rejected', 'withdrawn'])
  status: EntryStatus;
}
