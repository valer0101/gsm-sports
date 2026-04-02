import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SeedEntryDto {
  @ApiProperty()
  @IsUUID()
  entryId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  seed: number;
}

export class SetSeedNumbersDto {
  @ApiProperty({ type: [SeedEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedEntryDto)
  seeds: SeedEntryDto[];
}
