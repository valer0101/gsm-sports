import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotency records for Telegram match notifications. `UNIQUE
 * (tournament_id, match_id, kind)` makes the reminder cron safe to
 * run repeatedly — if the same (match, kind) is already recorded, the
 * insert is rejected and the sender skips silently.
 */
export class MatchNotifications1776000000000 implements MigrationInterface {
  name = 'MatchNotifications1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "match_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tournament_id" uuid NOT NULL,
        "match_id" character varying(100) NOT NULL,
        "kind" character varying(50) NOT NULL,
        "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_match_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_match_notifications_tournament_match_kind"
          UNIQUE ("tournament_id", "match_id", "kind")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_match_notifications_tournament_id"
        ON "match_notifications" ("tournament_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_match_notifications_match_id"
        ON "match_notifications" ("match_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_match_notifications_match_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_match_notifications_tournament_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "match_notifications"`);
  }
}
