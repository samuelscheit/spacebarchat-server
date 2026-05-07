import { MigrationInterface, QueryRunner } from "typeorm";

export class StringProfileBadgeIds1776450647003 implements MigrationInterface {
    name = "StringProfileBadgeIds1776450647003";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "badges" ALTER COLUMN "id" TYPE character varying USING "id"::character varying`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "badge_ids" TYPE character varying[] USING "badge_ids"::character varying[]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "badge_ids" TYPE int8[] USING "badge_ids"::int8[]`);
        await queryRunner.query(`ALTER TABLE "badges" ALTER COLUMN "id" TYPE int8 USING "id"::int8`);
    }
}
