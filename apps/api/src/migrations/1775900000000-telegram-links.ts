import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `telegram_links` — per-user binding of GSM account ↔ Telegram
 * chat id. Lets the bot push match notifications, opponent-withdrew
 * alerts, etc. (Phase 2.4).
 *
 * `chat_id` is `bigint` so large Telegram ids don't clip, stored as a
 * string by TypeORM to preserve full precision past 2^53.
 */
export class TelegramLinks1775900000000 implements MigrationInterface {
  name = 'TelegramLinks1775900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "telegram_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "chat_id" bigint NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_telegram_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_telegram_links_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_telegram_links_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_telegram_links_user_id"
        ON "telegram_links" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_telegram_links_chat_id"
        ON "telegram_links" ("chat_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_telegram_links_chat_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_telegram_links_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "telegram_links"`);
  }
}
