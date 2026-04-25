import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { BracketFormat } from '@gsm/shared-types';

/**
 * Body of `POST /v1/admin/tournaments/:id/generate-brackets` (Phase 3.3a).
 * Optional `bracketFormat` lets the organizer override the sport's
 * `defaultBracketFormat` for this event. Validation against the sport's
 * own `bracketFormats` allow-list happens in `BracketsService`.
 */
export class GenerateBracketsDto {
  @ApiProperty({
    required: false,
    enum: ['single_elim', 'double_elim', 'round_robin', 'swiss', 'groups_playoff'],
  })
  @IsOptional()
  @IsIn(['single_elim', 'double_elim', 'round_robin', 'swiss', 'groups_playoff'])
  bracketFormat?: BracketFormat;
}
