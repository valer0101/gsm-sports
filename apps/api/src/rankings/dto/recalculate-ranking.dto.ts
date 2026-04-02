import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, Max } from 'class-validator';

export class RecalculateRankingDto {
  @ApiProperty({ description: 'Sport UUID' })
  @IsUUID()
  sportId: string;

  @ApiProperty({ example: 2025 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  season: number;
}
