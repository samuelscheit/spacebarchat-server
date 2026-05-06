import { MigrationInterface, QueryRunner } from "typeorm";

export class StageInstances1778043000000 implements MigrationInterface {
    name = "StageInstances1778043000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "stage_instances" ("id" int8 NOT NULL, "guild_id" int8 NOT NULL, "channel_id" int8 NOT NULL, "topic" character varying(120) NOT NULL, "privacy_level" integer NOT NULL, "discoverable_disabled" boolean NOT NULL DEFAULT false, "guild_scheduled_event_id" int8, CONSTRAINT "UQ_stage_instances_channel_id" UNIQUE ("channel_id"), CONSTRAINT "PK_stage_instances_id" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `ALTER TABLE "stage_instances" ADD CONSTRAINT "FK_stage_instances_guild_id" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "stage_instances" ADD CONSTRAINT "FK_stage_instances_channel_id" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stage_instances" DROP CONSTRAINT "FK_stage_instances_channel_id"`);
        await queryRunner.query(`ALTER TABLE "stage_instances" DROP CONSTRAINT "FK_stage_instances_guild_id"`);
        await queryRunner.query(`DROP TABLE "stage_instances"`);
    }
}
