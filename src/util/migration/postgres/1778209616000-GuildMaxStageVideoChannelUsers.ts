import { MigrationInterface, QueryRunner } from "typeorm";

export class GuildMaxStageVideoChannelUsers1778209616000 implements MigrationInterface {
    name = "GuildMaxStageVideoChannelUsers1778209616000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "guilds" ADD "max_stage_video_channel_users" integer`);
        await queryRunner.query(`UPDATE "guilds" SET "max_stage_video_channel_users" = 50 WHERE "max_stage_video_channel_users" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "guilds" DROP COLUMN "max_stage_video_channel_users"`);
    }
}
