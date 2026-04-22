import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const CATEGORIES_TYPES = ['weight', 'age', 'skill', 'none'] as const;
const BRACKET_FORMATS = [
  'single_elim',
  'double_elim',
  'round_robin',
  'swiss',
  'groups_playoff',
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
}
