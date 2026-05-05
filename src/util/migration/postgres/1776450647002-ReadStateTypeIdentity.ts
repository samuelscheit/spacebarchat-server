import { MigrationInterface, QueryRunner } from "typeorm";

export class ReadStateTypeIdentity1776450647002 implements MigrationInterface {
    name = "ReadStateTypeIdentity1776450647002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_0abf8b443321bd3cf7f81ee17a"`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_read_states_user_resource_type" ON "read_states" ("channel_id", "user_id", "read_state_type")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_read_states_user_resource_type"`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_0abf8b443321bd3cf7f81ee17a" ON "read_states" ("channel_id", "user_id")`);
    }
}
