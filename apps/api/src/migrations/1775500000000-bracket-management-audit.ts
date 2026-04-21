import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds audit & management fields to the `brackets` table and creates the
 * `bracket_audit_logs` table for tracking all result changes, resets, and locks.
 *
 * Related to feature/tournament-bracket-manual — manual bracket management
 * for organizers and operators during live tournaments.
 */
export class BracketManagementAudit1775500000000 implements MigrationInterface {
  name = 'BracketManagementAudit1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Add audit / management columns to brackets ──────────────────
    await queryRunner.query(
      `ALTER TABLE "brackets"
        ADD COLUMN IF NOT EXISTS "last_modified_by" uuid NULL,
        ADD COLUMN IF NOT EXISTS "last_modified_at" TIMESTAMP WITH TIME ZONE NULL,
        ADD COLUMN IF NOT EXISTS "modification_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE NULL,
        ADD COLUMN IF NOT EXISTS "is_locked" boolean NOT NULL DEFAULT false`,
    );

    // ─── Create bracket_audit_logs table ──────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "bracket_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bracket_id" uuid NOT NULL,
        "match_id" character varying(100) NULL,
        "changed_by" uuid NULL,
        "action" character varying(50) NOT NULL,
        "old_value" jsonb NULL,
        "new_value" jsonb NULL,
        "reason" text NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bracket_audit_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bracket_audit_logs_bracket" FOREIGN KEY ("bracket_id")
          REFERENCES "brackets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bracket_audit_logs_user" FOREIGN KEY ("changed_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_bracket_audit_logs_bracket_id" ON "bracket_audit_logs" ("bracket_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bracket_audit_logs_bracket_created"
        ON "bracket_audit_logs" ("bracket_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bracket_audit_logs_changed_by" ON "bracket_audit_logs" ("changed_by")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bracket_audit_logs_changed_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bracket_audit_logs_bracket_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bracket_audit_logs_bracket_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bracket_audit_logs"`);

    await queryRunner.query(
      `ALTER TABLE "brackets"
        DROP COLUMN IF EXISTS "is_locked",
        DROP COLUMN IF EXISTS "completed_at",
        DROP COLUMN IF EXISTS "modification_count",
        DROP COLUMN IF EXISTS "last_modified_at",
        DROP COLUMN IF EXISTS "last_modified_by"`,
    );
  }
}
