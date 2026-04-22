import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';

export class ReplacePlayerDto {
  @ApiProperty({ description: 'Match id within the bracket (e.g. "wb_1_0")' })
  @IsString()
  @MinLength(1)
  matchId: string;

  @ApiProperty({ enum: [1, 2] })
  @IsIn([1, 2])
  position: 1 | 2;

  @ApiProperty({ description: 'Tournament entry id of the replacement athlete' })
  @IsUUID()
  newEntryId: string;

  @ApiProperty({ description: 'Reason for the replacement (audited)' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
