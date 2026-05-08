import { MigrationInterface, QueryRunner } from "typeorm";

export class MessageSlowmodeIndexes1778247700000 implements MigrationInterface {
    name = "MessageSlowmodeIndexes1778247700000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_messages_channel_timestamp" ON "messages" ("channel_id", "timestamp")`);
        await queryRunner.query(`CREATE INDEX "IDX_messages_channel_author_timestamp" ON "messages" ("channel_id", "author_id", "timestamp")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_messages_channel_author_timestamp"`);
        await queryRunner.query(`DROP INDEX "IDX_messages_channel_timestamp"`);
    }
}
