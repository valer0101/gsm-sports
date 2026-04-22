import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength, MaxLength } from 'class-validator';

export class WithdrawPlayerDto {
  @ApiProperty({ description: 'Match id within the bracket (e.g. "wb_1_0")' })
  @IsString()
  @MinLength(1)
  matchId: string;

  @ApiProperty({ enum: [1, 2] })
  @IsIn([1, 2])
  position: 1 | 2;

  @ApiProperty({
    description: 'Reason (no_show, injury, disqualification, other)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
