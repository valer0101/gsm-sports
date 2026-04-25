import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class RecordWeighInDto {
  @ApiProperty({ description: 'Tournament entry id being weighed' })
  @IsUUID()
  entryId: string;

  @ApiProperty({ description: 'Official weight measured on site, in kilograms' })
  @IsNumber()
  @Min(1)
  @Max(500)
  officialWeightKg: number;
}
