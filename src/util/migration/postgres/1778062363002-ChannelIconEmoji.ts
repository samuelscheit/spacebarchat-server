import { MigrationInterface, QueryRunner } from "typeorm";

export class ChannelIconEmoji1778062363002 implements MigrationInterface {
    name = "ChannelIconEmoji1778062363002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "channels" ADD "icon_emoji" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "channels" DROP COLUMN "icon_emoji"`);
    }
}
