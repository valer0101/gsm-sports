import { MigrationInterface, QueryRunner } from 'typeorm';

export class TournamentSystemPhase11775300000000 implements MigrationInterface {
  name = 'TournamentSystemPhase11775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. users: add dateOfBirth, make phone unique + indexed
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dateOfBirth" date`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_users_phone'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "UQ_users_phone" UNIQUE ("phone");
        END IF;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_phone" ON "users" ("phone")`);

    // 2. tournaments: add bracketGenerated, extend status column length
    await queryRunner.query(
      `ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "bracketGenerated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" ALTER COLUMN "status" TYPE character varying(30)`,
    );

    // 3. tournament_entries: add ageGroup, rename registeredWeight → weightKg, fix unique constraint
    await queryRunner.query(
      `ALTER TABLE "tournament_entries" ADD COLUMN IF NOT EXISTS "ageGroup" character varying(20)`,
    );
    // Rename only if old column exists
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tournament_entries' AND column_name = 'registeredWeight'
        ) THEN
          ALTER TABLE "tournament_entries" RENAME COLUMN "registeredWeight" TO "weight_kg";
        END IF;
      END $$;
    `);
    // Drop old unique constraint if exists
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_bafe4681a4446369a25b347803a'
        ) THEN
          ALTER TABLE "tournament_entries" DROP CONSTRAINT "UQ_bafe4681a4446369a25b347803a";
        END IF;
      END $$;
    `);
    // Add new unique constraint if not exists
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_entries_tournament_user_age_hand'
        ) THEN
          ALTER TABLE "tournament_entries"
            ADD CONSTRAINT "UQ_entries_tournament_user_age_hand"
            UNIQUE ("tournament_id", "user_id", "ageGroup", "hand");
        END IF;
      END $$;
    `);

    // 4. tournament_operators: new table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tournament_operators" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tournament_id" uuid NOT NULL,
        "operator_id" uuid NOT NULL,
        "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tournament_operators_tournament_operator" UNIQUE ("tournament_id", "operator_id"),
        CONSTRAINT "PK_tournament_operators" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tournament_operators_tournament_id" ON "tournament_operators" ("tournament_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tournament_operators_operator_id" ON "tournament_operators" ("operator_id")`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tournament_operators_tournament'
        ) THEN
          ALTER TABLE "tournament_operators"
            ADD CONSTRAINT "FK_tournament_operators_tournament"
            FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tournament_operators_operator'
        ) THEN
          ALTER TABLE "tournament_operators"
            ADD CONSTRAINT "FK_tournament_operators_operator"
            FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournament_operators" DROP CONSTRAINT IF EXISTS "FK_tournament_operators_operator"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_operators" DROP CONSTRAINT IF EXISTS "FK_tournament_operators_tournament"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tournament_operators_operator_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tournament_operators_tournament_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tournament_operators"`);

    await queryRunner.query(
      `ALTER TABLE "tournament_entries" DROP CONSTRAINT IF EXISTS "UQ_entries_tournament_user_age_hand"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_entries" ADD CONSTRAINT "UQ_bafe4681a4446369a25b347803a" UNIQUE ("tournament_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_entries" RENAME COLUMN "weight_kg" TO "registeredWeight"`,
    );
    await queryRunner.query(`ALTER TABLE "tournament_entries" DROP COLUMN IF EXISTS "ageGroup"`);

    await queryRunner.query(
      `ALTER TABLE "tournaments" ALTER COLUMN "status" TYPE character varying(20)`,
    );
    await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "bracketGenerated"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_phone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_users_phone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "dateOfBirth"`);
  }
}
