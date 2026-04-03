import { MigrationInterface, QueryRunner } from "typeorm";

export class RankingUniqueAddWeightCategory1775200000000 implements MigrationInterface {
    name = 'RankingUniqueAddWeightCategory1775200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop old unique constraint that lacked weightCategory
        await queryRunner.query(`ALTER TABLE "ranking_entries" DROP CONSTRAINT IF EXISTS "UQ_1f70575610e16fa06082fbe625d"`);
        // Add new unique constraint including weightCategory so one athlete
        // can hold rankings in multiple weight divisions simultaneously
        await queryRunner.query(`ALTER TABLE "ranking_entries" ADD CONSTRAINT "UQ_e611ca7f96b0d1e79b3b68dabc9" UNIQUE ("athlete_id", "sport_id", "season", "hand", "gender", "weightCategory")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ranking_entries" DROP CONSTRAINT IF EXISTS "UQ_e611ca7f96b0d1e79b3b68dabc9"`);
        await queryRunner.query(`ALTER TABLE "ranking_entries" ADD CONSTRAINT "UQ_1f70575610e16fa06082fbe625d" UNIQUE ("athlete_id", "sport_id", "season", "hand", "gender")`);
    }
}
