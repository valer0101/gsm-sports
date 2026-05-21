import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsIn, IsOptional, IsInt, Min } from 'class-validator';

/**
 * One pair in an admin-curated armfight fight card. Matches the engine's
 * `ArmfightPairSpec` (which uses `Player` objects); the API receives ids
 * and resolves them to players in `BracketsService.buildBracket`.
 */
export class ArmfightPairDto {
  @ApiProperty() @IsUUID() playerAId!: string;
  @ApiProperty() @IsUUID() playerBId!: string;

  @ApiProperty({ enum: ['left', 'right'] })
  @IsIn(['left', 'right'])
  hand!: 'left' | 'right';

  @ApiProperty({ required: false, description: 'Optional display order; defaults to position in pairs[]' })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}
