import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class RecordResultDto {
  @ApiProperty({ description: 'Match ID within the bracket (e.g. wb_1_0, lb_2_1, grand_final)' })
  @IsString()
  matchId: string;

  @ApiProperty({ description: 'Entry UUID of the winner' })
  @IsUUID()
  winnerId: string;

  @ApiProperty({
    description: 'Reason for correction (required when overriding an existing result)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({
    description: 'Force-overwrite existing result (admin/organizer only)',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceCorrect?: boolean;
}
