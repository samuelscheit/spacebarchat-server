import { MigrationInterface, QueryRunner } from "typeorm";

export class SessionGatewayIntents1778242600000 implements MigrationInterface {
    name = "SessionGatewayIntents1778242600000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "gateway_intents" character varying NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "gateway_intents"`);
    }
}
