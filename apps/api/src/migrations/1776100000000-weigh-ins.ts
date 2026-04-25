import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `weigh_ins` — one row per `tournament_entry` carrying the official
 * on-site weight measurement. Gates bracket generation for sports whose
 * `SportConfig.weighInRequired` is true (Phase 3.1).
 *
 * `entry_id` is `UNIQUE` so re-weighing is an upsert, not a new row, and
 * `tournament_id` is denormalised to skip a join in the per-tournament
 * admin listing.
 */
export class WeighIns1776100000000 implements MigrationInterface {
  name = 'WeighIns1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "weigh_ins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entry_id" uuid NOT NULL,
        "tournament_id" uuid NOT NULL,
        "official_weight_kg" numeric(5,2) NOT NULL,
        "verified_by" uuid NOT NULL,
        "verified_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_weigh_ins_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_weigh_ins_entry_id" UNIQUE ("entry_id"),
        CONSTRAINT "FK_weigh_ins_entry" FOREIGN KEY ("entry_id")
          REFERENCES "tournament_entries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_weigh_ins_verified_by" FOREIGN KEY ("verified_by")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_weigh_ins_entry_id"
        ON "weigh_ins" ("entry_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_weigh_ins_tournament_id"
        ON "weigh_ins" ("tournament_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_weigh_ins_tournament_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_weigh_ins_entry_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "weigh_ins"`);
  }
}
