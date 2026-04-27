import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `tournament_entries.athlete_country` — denormalised snapshot of
 * the athlete's country at registration time (Phase 3.4 team standings).
 * Joining live to `users.country` would make historical leaderboards
 * shift if an athlete updates their profile after the event, so the
 * value is captured into the entry row.
 *
 * Backfills existing rows from `users.country` so leaderboards for
 * already-completed tournaments still have a chance of being meaningful.
 * Rows whose user has no country recorded stay null and don't
 * contribute to team rankings.
 */
export class TeamStandingsSnapshot1776200000000 implements MigrationInterface {
  name = 'TeamStandingsSnapshot1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournament_entries"
        ADD COLUMN IF NOT EXISTS "athlete_country" varchar(100)`,
    );

    // Backfill from users.country for entries created before this column
    // existed. Skips rows that already have a value (idempotent re-run).
    await queryRunner.query(
      `UPDATE "tournament_entries" e
        SET "athlete_country" = u."country"
        FROM "users" u
        WHERE e."user_id" = u."id"
          AND e."athlete_country" IS NULL
          AND u."country" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tournament_entries_athlete_country"
        ON "tournament_entries" ("athlete_country")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tournament_entries_athlete_country"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_entries"
        DROP COLUMN IF EXISTS "athlete_country"`,
    );
  }
}
