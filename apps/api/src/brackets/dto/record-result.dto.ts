import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class RecordResultDto {
  @ApiProperty({ description: 'Match ID within the bracket' })
  @IsString()
  matchId: string;

  @ApiProperty({ description: 'Entry UUID of the winner' })
  @IsUUID()
  winnerId: string;
}
