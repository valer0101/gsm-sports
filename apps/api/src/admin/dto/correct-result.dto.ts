import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CorrectResultDto {
  @ApiProperty({ description: 'Match ID (e.g. wb_1_0, lb_2_1, grand_final)' })
  @IsString()
  matchId: string;

  @ApiProperty({ description: 'Entry UUID of the winner' })
  @IsUUID()
  winnerId: string;

  @ApiProperty({
    description: 'Reason for correction (required for audit trail)',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
