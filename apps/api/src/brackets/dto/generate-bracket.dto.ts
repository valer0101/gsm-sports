import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { BracketFormat } from '@gsm/shared-types';

class PlayerSeedDto {
  @ApiProperty()
  @IsString()
  entryId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  seed?: number;
}

export class GenerateBracketDto {
  @ApiProperty()
  @IsString()
  tournamentId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  weightCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ type: [PlayerSeedDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerSeedDto)
  playerSeeds?: PlayerSeedDto[];

  /**
   * Which bracket format to generate. Optional — falls back to the
   * sport's `SportConfig.defaultBracketFormat`. The service rejects any
   * value that isn't listed in the sport's `bracketFormats` allow-list,
   * so a chess organizer can't accidentally request a `double_elim`.
   *
   * Phase 3.3a only wires `single_elim` + `double_elim`; the other
   * three are still listed in the union (shared-types) but the service
   * throws a `BadRequestException` until their generators land.
   */
  @ApiProperty({
    required: false,
    enum: ['single_elim', 'double_elim', 'round_robin', 'swiss', 'groups_playoff', 'armfight'],
  })
  @IsOptional()
  @IsIn(['single_elim', 'double_elim', 'round_robin', 'swiss', 'groups_playoff', 'armfight'])
  bracketFormat?: BracketFormat;
}
