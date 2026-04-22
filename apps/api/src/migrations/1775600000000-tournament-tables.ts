import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `tournament_tables` — playing surfaces (tables / rings / courts / cages)
 * inside a tournament venue — and a nullable `table_id` FK on
 * `tournament_operators` so an organizer can pin an operator to one specific
 * table. A null `table_id` means the operator can work any table in the
 * tournament (current behavior, preserved for backward compatibility).
 *
 * Phase 2.1 of the roadmap — required groundwork for 200-athlete events with
 * multiple surfaces running in parallel.
 */
export class TournamentTables1775600000000 implements MigrationInterface {
  name = 'TournamentTables1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "tournament_tables" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tournament_id" uuid NOT NULL,
        "number" integer NOT NULL,
        "name" character varying(100) NULL,
        "status" character varying(20) NOT NULL DEFAULT 'idle',
        "notes" text NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_tables_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tournament_tables_tournament_number" UNIQUE ("tournament_id", "number"),
        CONSTRAINT "FK_tournament_tables_tournament" FOREIGN KEY ("tournament_id")
          REFERENCES "tournaments"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tournament_tables_tournament_id"
        ON "tournament_tables" ("tournament_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tournament_tables_status"
        ON "tournament_tables" ("status")`,
    );

    // ─── tournament_operators.table_id (nullable) ─────────────────────
    await queryRunner.query(
      `ALTER TABLE "tournament_operators"
        ADD COLUMN IF NOT EXISTS "table_id" uuid NULL`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        ALTER TABLE "tournament_operators"
          ADD CONSTRAINT "FK_tournament_operators_table"
          FOREIGN KEY ("table_id") REFERENCES "tournament_tables"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tournament_operators_table_id"
        ON "tournament_operators" ("table_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tournament_operators_table_id"`);
    await queryRunner.query(
      `ALTER TABLE "tournament_operators" DROP CONSTRAINT IF EXISTS "FK_tournament_operators_table"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_operators" DROP COLUMN IF EXISTS "table_id"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tournament_tables_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tournament_tables_tournament_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tournament_tables"`);
  }
}
