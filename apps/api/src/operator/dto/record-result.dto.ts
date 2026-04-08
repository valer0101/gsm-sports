import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecordResultDto {
  @ApiProperty()
  @IsString()
  matchId: string;

  @ApiProperty()
  @IsString()
  winnerId: string;
}
