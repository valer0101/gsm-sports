import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNewsTable1775400000000 implements MigrationInterface {
  name = 'AddNewsTable1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "news" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "slug" character varying(300) NOT NULL,
        "content" text NOT NULL,
        "excerpt" character varying(500),
        "coverImage" character varying(500),
        "category" character varying(50) NOT NULL DEFAULT 'news',
        "status" character varying(20) NOT NULL DEFAULT 'draft',
        "authorId" uuid NOT NULL,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_news_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_news_slug" ON "news" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_news_title" ON "news" ("title")`);
    await queryRunner.query(`CREATE INDEX "IDX_news_status" ON "news" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_news_category" ON "news" ("category")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_news_category"`);
    await queryRunner.query(`DROP INDEX "IDX_news_status"`);
    await queryRunner.query(`DROP INDEX "IDX_news_title"`);
    await queryRunner.query(`DROP INDEX "IDX_news_slug"`);
    await queryRunner.query(`DROP TABLE "news"`);
  }
}
