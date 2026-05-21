import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `password_reset_tokens` — single-use, time-limited tokens for the
 * forgot-password flow. Token is stored hashed (SHA-256 hex), plaintext
 * only ever in the outgoing email. `ON DELETE CASCADE` on user_id keeps
 * the table cleaner after a user deletion.
 */
export class PasswordResetTokens1779580000000 implements MigrationInterface {
  name = 'PasswordResetTokens1779580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_user_id"
        ON "password_reset_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_token_hash"
        ON "password_reset_tokens" ("token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_password_reset_tokens_token_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_password_reset_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
  }
}
