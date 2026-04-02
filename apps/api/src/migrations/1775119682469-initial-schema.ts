import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1775119682469 implements MigrationInterface {
    name = 'InitialSchema1775119682469'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "passwordHash" character varying(255), "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "avatarUrl" character varying(500), "phone" character varying(20), "country" character varying(100), "city" character varying(100), "language" character varying(5) NOT NULL DEFAULT 'hy', "roles" text NOT NULL DEFAULT 'user', "isVerified" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "sports" ("id" SERIAL NOT NULL, "slug" character varying(50) NOT NULL, "nameRu" character varying(100) NOT NULL, "nameEn" character varying(100) NOT NULL, "nameHy" character varying(100) NOT NULL, "iconUrl" character varying(500), "descriptionRu" text, "descriptionEn" text, "descriptionHy" text, "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "config" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_be96c1d313b6d198a17b08f4c63" UNIQUE ("slug"), CONSTRAINT "PK_4fa1063d368e1fd68ea63c7d860" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "weight_categories" ("id" SERIAL NOT NULL, "tournament_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "minWeight" numeric(5,2), "maxWeight" numeric(5,2), "gender" character varying(10) NOT NULL DEFAULT 'male', "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_0558c5d40894fe21a3a66003b44" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a7a07411dcd642fadf683dcb8d" ON "weight_categories" ("tournament_id") `);
        await queryRunner.query(`CREATE TABLE "tournaments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sport_id" integer NOT NULL, "organizer_id" uuid NOT NULL, "name" character varying(300) NOT NULL, "slug" character varying(300) NOT NULL, "descriptionRu" text, "descriptionEn" text, "descriptionHy" text, "startDate" TIMESTAMP WITH TIME ZONE NOT NULL, "endDate" TIMESTAMP WITH TIME ZONE, "location" character varying(300), "country" character varying(100), "city" character varying(100), "format" character varying(50) NOT NULL DEFAULT 'double_elimination', "maxParticipants" integer, "registrationOpen" boolean NOT NULL DEFAULT false, "registrationDeadline" TIMESTAMP WITH TIME ZONE, "status" character varying(20) NOT NULL DEFAULT 'draft', "isFeatured" boolean NOT NULL DEFAULT false, "isLive" boolean NOT NULL DEFAULT false, "posterUrl" character varying(500), "streamUrl" character varying(500), "sportConfig" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_517ca03e32d7ff1162ab4631c82" UNIQUE ("slug"), CONSTRAINT "PK_6d5d129da7a80cf99e8ad4833a9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_186453945127b1b37ff7c22984" ON "tournaments" ("sport_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_517ca03e32d7ff1162ab4631c8" ON "tournaments" ("slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_86eb37df073cbf54a27a0739a2" ON "tournaments" ("startDate") `);
        await queryRunner.query(`CREATE INDEX "IDX_5bdbbbf95bc2bcb5caada90f0c" ON "tournaments" ("status") `);
        await queryRunner.query(`CREATE TABLE "tournament_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tournament_id" uuid NOT NULL, "user_id" uuid NOT NULL, "weight_category_id" integer, "status" character varying(20) NOT NULL DEFAULT 'pending', "hand" character varying(10), "registeredWeight" numeric(5,2), "seedNumber" integer, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bafe4681a4446369a25b347803a" UNIQUE ("tournament_id", "user_id"), CONSTRAINT "PK_6787159985071e204cbc079bbd8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1e80943043013463f8872d4155" ON "tournament_entries" ("tournament_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fbe191d639b7f1a0cb672f377b" ON "tournament_entries" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1b1fc414bd6403e301084abb2c" ON "tournament_entries" ("status") `);
        await queryRunner.query(`CREATE TABLE "brackets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tournament_id" uuid NOT NULL, "weight_category_id" integer, "status" character varying(20) NOT NULL DEFAULT 'pending', "bracketData" jsonb, "name" character varying(200), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_557930575b564b859ce0f0c99c5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_99629f5385450eef5a2f90b12b" ON "brackets" ("tournament_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9367e27dc8f447b1c1da5a671" ON "brackets" ("status") `);
        await queryRunner.query(`ALTER TABLE "weight_categories" ADD CONSTRAINT "FK_a7a07411dcd642fadf683dcb8da" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tournaments" ADD CONSTRAINT "FK_186453945127b1b37ff7c22984d" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tournaments" ADD CONSTRAINT "FK_98426b7ee64c5263e68f368bc72" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tournament_entries" ADD CONSTRAINT "FK_1e80943043013463f8872d41553" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tournament_entries" ADD CONSTRAINT "FK_fbe191d639b7f1a0cb672f377b5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tournament_entries" ADD CONSTRAINT "FK_18534327819464097ad822f26dd" FOREIGN KEY ("weight_category_id") REFERENCES "weight_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "brackets" ADD CONSTRAINT "FK_99629f5385450eef5a2f90b12b2" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "brackets" ADD CONSTRAINT "FK_caf5e91b7191c86f2f3ddb50bb1" FOREIGN KEY ("weight_category_id") REFERENCES "weight_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "brackets" DROP CONSTRAINT "FK_caf5e91b7191c86f2f3ddb50bb1"`);
        await queryRunner.query(`ALTER TABLE "brackets" DROP CONSTRAINT "FK_99629f5385450eef5a2f90b12b2"`);
        await queryRunner.query(`ALTER TABLE "tournament_entries" DROP CONSTRAINT "FK_18534327819464097ad822f26dd"`);
        await queryRunner.query(`ALTER TABLE "tournament_entries" DROP CONSTRAINT "FK_fbe191d639b7f1a0cb672f377b5"`);
        await queryRunner.query(`ALTER TABLE "tournament_entries" DROP CONSTRAINT "FK_1e80943043013463f8872d41553"`);
        await queryRunner.query(`ALTER TABLE "tournaments" DROP CONSTRAINT "FK_98426b7ee64c5263e68f368bc72"`);
        await queryRunner.query(`ALTER TABLE "tournaments" DROP CONSTRAINT "FK_186453945127b1b37ff7c22984d"`);
        await queryRunner.query(`ALTER TABLE "weight_categories" DROP CONSTRAINT "FK_a7a07411dcd642fadf683dcb8da"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e9367e27dc8f447b1c1da5a671"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_99629f5385450eef5a2f90b12b"`);
        await queryRunner.query(`DROP TABLE "brackets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1b1fc414bd6403e301084abb2c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fbe191d639b7f1a0cb672f377b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1e80943043013463f8872d4155"`);
        await queryRunner.query(`DROP TABLE "tournament_entries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5bdbbbf95bc2bcb5caada90f0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_86eb37df073cbf54a27a0739a2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_517ca03e32d7ff1162ab4631c8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_186453945127b1b37ff7c22984"`);
        await queryRunner.query(`DROP TABLE "tournaments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7a07411dcd642fadf683dcb8d"`);
        await queryRunner.query(`DROP TABLE "weight_categories"`);
        await queryRunner.query(`DROP TABLE "sports"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
