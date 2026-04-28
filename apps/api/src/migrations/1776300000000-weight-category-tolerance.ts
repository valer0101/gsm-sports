import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `weight_tolerance_kg` to `weight_categories` (Phase 4 — weight tolerance).
 *
 * A non-zero tolerance means an athlete whose registered/official weight
 * exceeds `maxWeight` by up to `weightToleranceKg` is still allowed in
 * the category. Default `0` preserves the strict legacy behavior.
 */
export class WeightCategoryTolerance1776300000000 implements MigrationInterface {
  name = 'WeightCategoryTolerance1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "weight_categories" ADD COLUMN IF NOT EXISTS "weight_tolerance_kg" numeric(5,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "weight_categories" DROP COLUMN IF EXISTS "weight_tolerance_kg"`,
    );
  }
}
