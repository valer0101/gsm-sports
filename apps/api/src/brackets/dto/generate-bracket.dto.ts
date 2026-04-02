import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsArray, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

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
}
