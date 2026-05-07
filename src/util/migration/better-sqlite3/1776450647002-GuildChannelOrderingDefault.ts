import { MigrationInterface, QueryRunner } from "typeorm";

export class GuildChannelOrderingDefault1776450647002 implements MigrationInterface {
    name = "GuildChannelOrderingDefault1776450647002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE guilds SET channel_ordering = '' WHERE channel_ordering IS NULL;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log(`Migration ${this.name}.down() not implemented`);
    }
}
