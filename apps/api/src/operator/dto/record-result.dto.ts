import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecordResultDto {
  @ApiProperty({ description: 'Match ID (e.g. wb_1_0, lb_2_1, grand_final)' })
  @IsString()
  matchId: string;

  @ApiProperty({ description: 'Entry UUID of the winner' })
  @IsString()
  winnerId: string;

  @ApiProperty({ description: 'Optional note about this result', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
