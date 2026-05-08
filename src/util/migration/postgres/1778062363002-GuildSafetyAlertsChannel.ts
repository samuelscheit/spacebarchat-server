import { MigrationInterface, QueryRunner } from "typeorm";

export class GuildSafetyAlertsChannel1778062363002 implements MigrationInterface {
    name = "GuildSafetyAlertsChannel1778062363002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "guilds" ADD "safety_alerts_channel_id" int8`);
        await queryRunner.query(`ALTER TABLE "guilds" ADD CONSTRAINT "FK_guilds_safety_alerts_channel_id" FOREIGN KEY ("safety_alerts_channel_id") REFERENCES "channels"("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "guilds" DROP CONSTRAINT "FK_guilds_safety_alerts_channel_id"`);
        await queryRunner.query(`ALTER TABLE "guilds" DROP COLUMN "safety_alerts_channel_id"`);
    }
}
