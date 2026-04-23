import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';

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

  /**
   * Sport-specific result detail (Phase 3.2). Its `schema` field must
   * match the tournament's `SportConfig.matchResultSchema`; shape is
   * validated server-side by `validateMatchResult`. Omit entirely to
   * preserve any prior payload on a correction; send `null` to clear it.
   *
   * Typed loosely here because class-validator doesn't handle
   * discriminated-union validation well — the detailed shape check lives
   * in the service.
   */
  @ApiProperty({
    description:
      "Sport-specific result detail. See `MatchResult` in @gsm/shared-types. Must carry a `schema` field equal to the tournament's matchResultSchema.",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown> | null;
}
