import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const CATEGORIES_TYPES = ['weight', 'age', 'skill', 'none'] as const;
const BRACKET_FORMATS = [
  'single_elim',
  'double_elim',
  'round_robin',
  'swiss',
  'groups_playoff',
  'armfight',
] as const;
const MATCH_RESULT_SCHEMAS = [
  'simple_winner',
  'armwrestling',
  'score',
  'time',
  'points',
] as const;

export class LocalizedTermDto {
  @ApiProperty() @IsString() @MaxLength(64) ru: string;
  @ApiProperty() @IsString() @MaxLength(64) en: string;
  @ApiProperty() @IsString() @MaxLength(64) hy: string;
}

/**
 * Validated shape for `SportConfig.teamScoring` (Phase 3.4). The DTO
 * accepts an object whose keys are stringified positive integers and
 * values are non-negative numbers; deeper validation (numeric keys,
 * sane ranges) happens at write time in `SportsService` rather than
 * in class-validator since `Record<number, number>` isn't a first-class
 * decorator target.
 */
export class TeamScoringConfigDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { 1: 7, 2: 5, 3: 3, 4: 1 },
    description:
      '1-based final-placement → points map. Missing positions score 0.',
  })
  @IsObject()
  pointsByPlace: Record<number, number>;
}

export class TermPairDto {
  @ApiProperty({ type: LocalizedTermDto })
  @ValidateNested()
  @Type(() => LocalizedTermDto)
  singular: LocalizedTermDto;

  @ApiProperty({ type: LocalizedTermDto })
  @ValidateNested()
  @Type(() => LocalizedTermDto)
  plural: LocalizedTermDto;
}

/**
 * Validated shape for `Sport.config` (JSONB blob). Enforced by
 * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` in main.ts
 * so clients can't persist arbitrary keys into the DB.
 */
export class SportConfigDto {
  @ApiProperty({ enum: CATEGORIES_TYPES, required: false })
  @IsOptional()
  @IsIn(CATEGORIES_TYPES as unknown as string[])
  categoriesType?: (typeof CATEGORIES_TYPES)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasHands?: boolean;

  @ApiProperty({ enum: BRACKET_FORMATS, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsIn(BRACKET_FORMATS as unknown as string[], { each: true })
  bracketFormats?: (typeof BRACKET_FORMATS)[number][];

  @ApiProperty({ enum: BRACKET_FORMATS, required: false })
  @IsOptional()
  @IsIn(BRACKET_FORMATS as unknown as string[])
  defaultBracketFormat?: (typeof BRACKET_FORMATS)[number];

  @ApiProperty({ enum: MATCH_RESULT_SCHEMAS, required: false })
  @IsOptional()
  @IsIn(MATCH_RESULT_SCHEMAS as unknown as string[])
  matchResultSchema?: (typeof MATCH_RESULT_SCHEMAS)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  weighInRequired?: boolean;

  @ApiProperty({ type: TermPairDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => TermPairDto)
  surfaceTerm?: TermPairDto;

  @ApiProperty({ type: TermPairDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => TermPairDto)
  participantTerm?: TermPairDto;

  @ApiProperty({
    required: false,
    minimum: 30,
    maximum: 36000,
    description: 'Typical match duration in seconds (scheduler input)',
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(36000)
  avgMatchDurationSec?: number;

  @ApiProperty({
    required: false,
    minimum: 0,
    maximum: 86400,
    description: "Minimum rest between an athlete's own matches, in seconds",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  minRestBetweenMatchesSec?: number;

  @ApiProperty({
    required: false,
    description:
      'If true, entries must be `checked_in` when the category starts — no-shows are auto-forfeited',
  })
  @IsOptional()
  @IsBoolean()
  requireCheckIn?: boolean;

  @ApiProperty({ type: TeamScoringConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => TeamScoringConfigDto)
  teamScoring?: TeamScoringConfigDto;
}
