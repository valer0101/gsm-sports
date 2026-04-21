import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ResetMatchDto {
  @ApiProperty({ description: 'Match ID to reset (e.g. wb_1_0, grand_final)' })
  @IsString()
  matchId: string;

  @ApiProperty({ description: 'Reason for resetting this match', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
