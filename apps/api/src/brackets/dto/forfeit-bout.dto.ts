import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ForfeitBoutDto {
  @ApiProperty({ description: 'Match id, e.g. "wb_1_3"' })
  @IsString()
  boutId!: string;

  @ApiProperty({ description: 'Player id of the bout winner (the side still able to compete)' })
  @IsString()
  winnerId!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  walkoverReason?: string;
}
