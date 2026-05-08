import { MigrationInterface, QueryRunner } from "typeorm";

export class GuildSafetyAlertsChannel1778209700000 implements MigrationInterface {
    name = "GuildSafetyAlertsChannel1778209700000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE guilds ADD safety_alerts_channel_id int8`);
        await queryRunner.query(`ALTER TABLE guilds ADD CONSTRAINT "FK_98f612b904dddc6b5b2f848aa42" FOREIGN KEY (safety_alerts_channel_id) REFERENCES channels(id)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE guilds DROP CONSTRAINT "FK_98f612b904dddc6b5b2f848aa42"`);
        await queryRunner.query(`ALTER TABLE guilds DROP COLUMN safety_alerts_channel_id`);
    }
}
