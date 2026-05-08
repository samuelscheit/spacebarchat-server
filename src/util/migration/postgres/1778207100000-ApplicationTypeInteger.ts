import { MigrationInterface, QueryRunner } from "typeorm";

export class ApplicationTypeInteger1778207100000 implements MigrationInterface {
    name = "ApplicationTypeInteger1778207100000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE applications ALTER COLUMN "type" TYPE integer USING CASE
            WHEN "type" IS NULL THEN NULL
            WHEN jsonb_typeof("type") = 'number' THEN ("type" #>> '{}')::integer
            WHEN jsonb_typeof("type") = 'string' AND ("type" #>> '{}') ~ '^[0-9]+$' THEN ("type" #>> '{}')::integer
            ELSE NULL
        END;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE applications ALTER COLUMN "type" TYPE jsonb USING to_jsonb("type");`);
    }
}
