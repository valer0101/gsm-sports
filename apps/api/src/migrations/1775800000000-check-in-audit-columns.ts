import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds physical check-in tracking to `tournament_entries`:
 *   - `checked_in_at` — timestamp when the athlete was marked present on-site
 *     (by QR scan or manual toggle in admin).
 *   - `checked_in_by` — user id of the admin / organizer who performed it.
 *
 * The `checked_in` value of `EntryStatus` is stored in the existing `status`
 * varchar column — no schema change needed there, just a new allowed string.
 *
 * Phase 2.3 of the roadmap — required so no-show detection and auto-forfeit
 * (follow-up PR) can reason about who is physically present.
 */
export class CheckInAuditColumns1775800000000 implements MigrationInterface {
  name = 'CheckInAuditColumns1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournament_entries"
        ADD COLUMN IF NOT EXISTS "checked_in_at" TIMESTAMP WITH TIME ZONE NULL,
        ADD COLUMN IF NOT EXISTS "checked_in_by" uuid NULL`,
    );

    await queryRunner.query(
      `DO $$ BEGIN
        ALTER TABLE "tournament_entries"
          ADD CONSTRAINT "FK_tournament_entries_checked_in_by"
          FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tournament_entries_checked_in_by"
        ON "tournament_entries" ("checked_in_by")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tournament_entries_checked_in_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_entries" DROP CONSTRAINT IF EXISTS "FK_tournament_entries_checked_in_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_entries"
        DROP COLUMN IF EXISTS "checked_in_by",
        DROP COLUMN IF EXISTS "checked_in_at"`,
    );
  }
}
