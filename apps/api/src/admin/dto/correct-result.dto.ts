import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';

export class CorrectResultDto {
  @ApiProperty({ description: 'Match ID (e.g. wb_1_0, lb_2_1, grand_final)' })
  @IsString()
  matchId: string;

  @ApiProperty({ description: 'Entry UUID of the winner' })
  @IsUUID()
  winnerId: string;

  @ApiProperty({ description: 'Reason for correction', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
