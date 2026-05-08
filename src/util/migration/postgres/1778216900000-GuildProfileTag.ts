import { MigrationInterface, QueryRunner } from "typeorm";

export class GuildProfileTag1778216900000 implements MigrationInterface {
    name = "GuildProfileTag1778216900000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "profile_tag" character varying(4)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "guilds" DROP COLUMN IF EXISTS "profile_tag"`);
    }
}
