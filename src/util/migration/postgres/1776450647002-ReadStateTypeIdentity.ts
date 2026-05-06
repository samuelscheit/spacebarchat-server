import { MigrationInterface, QueryRunner } from "typeorm";

export class ReadStateTypeIdentity1776450647002 implements MigrationInterface {
    name = "ReadStateTypeIdentity1776450647002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "read_states" DROP CONSTRAINT IF EXISTS "FK_40da2fca4e0eaf7a23b5bfc5d34"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_0abf8b443321bd3cf7f81ee17a"`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_read_states_user_resource_type" ON "read_states" ("channel_id", "user_id", "read_state_type")`);
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION "delete_channel_read_states"()
            RETURNS trigger AS $$
            BEGIN
                DELETE FROM "read_states" WHERE "channel_id" = OLD."id" AND "read_state_type" = 0;
                RETURN OLD;
            END;
            $$ LANGUAGE plpgsql
        `);
        await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_delete_channel_read_states" ON "channels"`);
        await queryRunner.query(`
            CREATE TRIGGER "TRG_delete_channel_read_states"
            AFTER DELETE ON "channels"
            FOR EACH ROW
            EXECUTE FUNCTION "delete_channel_read_states"()
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_delete_channel_read_states" ON "channels"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS "delete_channel_read_states"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_read_states_user_resource_type"`);
        await queryRunner.query(`DELETE FROM "read_states" WHERE "read_state_type" <> 0`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_0abf8b443321bd3cf7f81ee17a" ON "read_states" ("channel_id", "user_id")`);
        await queryRunner.query(
            `ALTER TABLE "read_states" ADD CONSTRAINT "FK_40da2fca4e0eaf7a23b5bfc5d34" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE`,
        );
    }
}
