import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  IsUrl,
  MaxLength,
  Min,
  IsNumber,
  IsUUID,
  IsObject,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WeightCategoryInput {
  @ApiProperty({ example: 'до 70 кг' })
  @IsString()
  name: string;

  @ApiProperty({ example: 60, required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  minWeight?: number | null;

  @ApiProperty({ example: 70, required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  maxWeight?: number | null;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateTournamentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(300)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nameHy?: string;

  // sportId is `string` on the entity but the live prod schema has
  // `sports.id` as SERIAL integer (see prod_schema_drift_2026_05_25 memory).
  // Until that's migrated to uuid, validate as a non-empty string and let
  // Postgres cast on insert. UUID-strict validation here would reject every
  // tournament-create from the live admin wizard.
  @ApiProperty()
  @IsString()
  @MaxLength(36)
  sportId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descriptionHy?: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  location: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxParticipants?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false })
  posterUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false })
  streamUrl?: string;

  @ApiProperty({ required: false, description: 'Recording / YouTube link shown post-event' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  armfightVideoUrl?: string;

  /** Arm wrestling specific config: competitionType, ageGroups, hands, entryFee */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  sportConfig?: Record<string, unknown>;

  /** Weight categories to pre-create for this tournament */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  weightCategories?: WeightCategoryInput[];
}
