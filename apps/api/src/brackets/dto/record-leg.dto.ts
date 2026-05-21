import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, Max, IsIn, IsOptional } from 'class-validator';

export class RecordLegDto {
  @ApiProperty({ description: 'Match id, e.g. "wb_1_3"' })
  @IsString()
  boutId!: string;

  @ApiProperty({ description: '1..5, must be next-in-sequence' })
  @IsInt() @Min(1) @Max(5)
  legIndex!: number;

  @ApiProperty()
  @IsString()
  winnerId!: string;

  @ApiProperty({ enum: ['pin', 'foul', 'dq'] })
  @IsIn(['pin', 'foul', 'dq'])
  winType!: 'pin' | 'foul' | 'dq';

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  enteredAt?: string;
}
