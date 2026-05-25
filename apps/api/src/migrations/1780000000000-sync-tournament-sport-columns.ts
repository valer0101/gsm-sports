import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrective migration. Adds columns that exist in the entities but were
 * never written into a migration — `synchronize: true` masked the drift in
 * dev DBs, but prod (synchronize off, migrations only) was missing them and
 * crashed every read of tournaments/athletes/rankings with
 * `column ... does not exist`.
 *
 * - tournaments: `nameRu`, `nameEn`, `nameHy` (Tournament entity lines 39-46)
 * - sports: `updatedAt` (Sport entity line 50)
 */
export class SyncTournamentSportColumns1780000000000 implements MigrationInterface {
  name = 'SyncTournamentSportColumns1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "nameRu" character varying(300)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "nameEn" character varying(300)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "nameHy" character varying(300)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sports" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sports" DROP COLUMN IF EXISTS "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "nameHy"`);
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "nameEn"`);
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "nameRu"`);
  }
}
