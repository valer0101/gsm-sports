import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAthletesRankings1775120227743 implements MigrationInterface {
    name = 'AddAthletesRankings1775120227743'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "athletes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "sport_id" integer NOT NULL, "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "slug" character varying(250) NOT NULL, "country" character varying(100), "city" character varying(100), "dateOfBirth" date, "gender" character varying(10), "primaryHand" character varying(10), "weight" numeric(5,2), "height" numeric(5,2), "experienceLevel" character varying(20), "bioRu" text, "bioEn" text, "bioHy" text, "photoUrl" character varying(500), "socialLinks" jsonb NOT NULL DEFAULT '{}', "achievements" jsonb NOT NULL DEFAULT '{}', "worldRank" integer, "countryRank" integer, "totalPoints" integer NOT NULL DEFAULT '0', "isVerified" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3b92d2bd187b2b2d27d4c47f1c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cec24cd7ba9d1a0730443b93ce" ON "athletes" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e98db3cba9b686c19757b5fd7" ON "athletes" ("sport_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b6734965762c66cf79e6fc758c" ON "athletes" ("slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_b8ff67967f8facbf7507d38cb9" ON "athletes" ("country") `);
        await queryRunner.query(`CREATE INDEX "IDX_9dacd120a5d39219ee0ca75af4" ON "athletes" ("gender") `);
        await queryRunner.query(`CREATE INDEX "IDX_2e553af5c6003379ac0a6afe3c" ON "athletes" ("worldRank") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ac4182c50daceb06568c50380" ON "athletes" ("countryRank") `);
        await queryRunner.query(`CREATE TABLE "ranking_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "athlete_id" uuid NOT NULL, "sport_id" integer NOT NULL, "season" integer NOT NULL, "points" integer NOT NULL DEFAULT '0', "country" character varying(100), "hand" character varying(10), "gender" character varying(10), "weightCategory" character varying(100), "worldPosition" integer, "countryPosition" integer, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_1f70575610e16fa06082fbe625d" UNIQUE ("athlete_id", "sport_id", "season", "hand", "gender"), CONSTRAINT "PK_d96715e4495075ef3427c9d0953" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_10be368b9bbcce8870e9367913" ON "ranking_entries" ("athlete_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d79e26d72da50445d52747e231" ON "ranking_entries" ("sport_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_77c344b066df5fa28e29516d8a" ON "ranking_entries" ("season") `);
        await queryRunner.query(`CREATE INDEX "IDX_d44a96558a2865a0b2fb6acbb9" ON "ranking_entries" ("country") `);
        await queryRunner.query(`CREATE INDEX "IDX_da895db969b474cc439f5e90f2" ON "ranking_entries" ("worldPosition") `);
        await queryRunner.query(`ALTER TABLE "athletes" ADD CONSTRAINT "FK_cec24cd7ba9d1a0730443b93ce1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "athletes" ADD CONSTRAINT "FK_5e98db3cba9b686c19757b5fd72" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ranking_entries" ADD CONSTRAINT "FK_10be368b9bbcce8870e93679136" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ranking_entries" ADD CONSTRAINT "FK_d79e26d72da50445d52747e231b" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ranking_entries" DROP CONSTRAINT "FK_d79e26d72da50445d52747e231b"`);
        await queryRunner.query(`ALTER TABLE "ranking_entries" DROP CONSTRAINT "FK_10be368b9bbcce8870e93679136"`);
        await queryRunner.query(`ALTER TABLE "athletes" DROP CONSTRAINT "FK_5e98db3cba9b686c19757b5fd72"`);
        await queryRunner.query(`ALTER TABLE "athletes" DROP CONSTRAINT "FK_cec24cd7ba9d1a0730443b93ce1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da895db969b474cc439f5e90f2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d44a96558a2865a0b2fb6acbb9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_77c344b066df5fa28e29516d8a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d79e26d72da50445d52747e231"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_10be368b9bbcce8870e9367913"`);
        await queryRunner.query(`DROP TABLE "ranking_entries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4ac4182c50daceb06568c50380"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2e553af5c6003379ac0a6afe3c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9dacd120a5d39219ee0ca75af4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b8ff67967f8facbf7507d38cb9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b6734965762c66cf79e6fc758c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e98db3cba9b686c19757b5fd7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cec24cd7ba9d1a0730443b93ce"`);
        await queryRunner.query(`DROP TABLE "athletes"`);
    }

}
