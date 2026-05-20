import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArmfightVideoUrl1779196949608 implements MigrationInterface {
    name = 'AddArmfightVideoUrl1779196949608'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tournaments" ADD "armfightVideoUrl" character varying(500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tournaments" DROP COLUMN "armfightVideoUrl"`);
    }

}
