import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `googleId` to `users` to back Google OAuth sign-in. Nullable +
 * unique so password-only accounts stay valid and Google accounts can't
 * collide. Indexed for the OAuth callback lookup path.
 */
export class AddGoogleId1776400000000 implements MigrationInterface {
  name = 'AddGoogleId1776400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_googleId" UNIQUE ("googleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_googleId" ON "users" ("googleId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_googleId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_googleId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "googleId"`);
  }
}
