import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `email_verification_tokens`. Same shape as `password_reset_tokens`
 * — single-use, hashed, 24h TTL (set by service, not the DB). Soft-gate
 * launch policy: rows are issued on register and on /auth/resend-verification
 * but verification is NOT required for core flows. See ROADMAP.
 */
export class EmailVerificationTokens1779680000000 implements MigrationInterface {
  name = 'EmailVerificationTokens1779680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verification_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_verification_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_user_id"
        ON "email_verification_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_token_hash"
        ON "email_verification_tokens" ("token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_verification_tokens_token_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_email_verification_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_verification_tokens"`);
  }
}
