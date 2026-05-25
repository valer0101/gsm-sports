import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Continuation of 1780000000000-sync-tournament-sport-columns. The
 * `weight_categories` table is missing `createdAt`/`updatedAt`, which are
 * declared on the WeightCategory entity (CreateDateColumn / UpdateDateColumn).
 * Because TournamentsService.findAll uses
 * `leftJoinAndSelect('t.weightCategories', 'wc')`, every read of the
 * tournaments list selects `wc.createdAt`/`wc.updatedAt` and crashes the
 * query when those columns don't exist.
 */
export class AddWeightCategoryTimestamps1780000000001 implements MigrationInterface {
  name = 'AddWeightCategoryTimestamps1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "weight_categories" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "weight_categories" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "weight_categories" DROP COLUMN IF EXISTS "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "weight_categories" DROP COLUMN IF EXISTS "createdAt"`);
  }
}
