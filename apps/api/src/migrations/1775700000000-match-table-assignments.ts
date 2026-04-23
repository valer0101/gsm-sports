import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `match_table_assignments` — each row binds one bracket match to
 * one playing surface for one running/finished cycle. Enables the per-table
 * operator queue (Phase 2.1 continuation) and the upcoming auto-scheduler
 * + arena display features.
 *
 * At-most-one active assignment per (tournament, match) is enforced by a
 * UNIQUE partial index on `(tournament_id, match_id) WHERE finished_at IS
 * NULL` — without this, two concurrent `claimNextForTable` calls on
 * different idle tables could both pick the same pending match. A finished
 * match frees the slot naturally (it drops out of the partial index).
 */
export class MatchTableAssignments1775700000000 implements MigrationInterface {
  name = 'MatchTableAssignments1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "match_table_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tournament_id" uuid NOT NULL,
        "bracket_id" uuid NOT NULL,
        "match_id" character varying(100) NOT NULL,
        "table_id" uuid NOT NULL,
        "claimed_by" uuid NULL,
        "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "started_at" TIMESTAMP WITH TIME ZONE NULL,
        "finished_at" TIMESTAMP WITH TIME ZONE NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_match_table_assignments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_match_table_assignments_tournament" FOREIGN KEY ("tournament_id")
          REFERENCES "tournaments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_match_table_assignments_bracket" FOREIGN KEY ("bracket_id")
          REFERENCES "brackets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_match_table_assignments_table" FOREIGN KEY ("table_id")
          REFERENCES "tournament_tables"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_match_table_assignments_claimed_by" FOREIGN KEY ("claimed_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mta_tournament_id"
        ON "match_table_assignments" ("tournament_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mta_bracket_id"
        ON "match_table_assignments" ("bracket_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mta_match_id"
        ON "match_table_assignments" ("match_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mta_table_id"
        ON "match_table_assignments" ("table_id")`,
    );
    // UNIQUE partial index: enforces at-most-one active assignment per
    // (tournament, match) at the database layer. Two concurrent claims on
    // the same match now fail loudly with a constraint violation instead of
    // silently double-booking.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mta_tournament_match_active"
        ON "match_table_assignments" ("tournament_id", "match_id")
        WHERE "finished_at" IS NULL`,
    );
    // Fast lookup for "what's running on this table right now".
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mta_table_active"
        ON "match_table_assignments" ("table_id")
        WHERE "finished_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mta_table_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_mta_tournament_match_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mta_table_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mta_match_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mta_bracket_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mta_tournament_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "match_table_assignments"`);
  }
}
