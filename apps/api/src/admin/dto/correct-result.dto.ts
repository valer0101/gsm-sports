import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  /**
   * Optional sport-specific result detail (Phase 3.2). Same semantics as
   * `RecordResultDto.result` — omit to preserve the prior blob, send
   * `null` to clear it, or send an object validated against the
   * tournament's `matchResultSchema`.
   */
  @ApiProperty({
    description:
      'Sport-specific result detail (optional). See MatchResult in @gsm/shared-types.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown> | null;
}
