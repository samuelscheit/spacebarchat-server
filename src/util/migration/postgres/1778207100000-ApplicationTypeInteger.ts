import { MigrationInterface, QueryRunner } from "typeorm";

const validApplicationTypeValues = ["1", "2", "3", "4"];

export class ApplicationTypeInteger1778207100000 implements MigrationInterface {
    name = "ApplicationTypeInteger1778207100000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE applications ALTER COLUMN "type" TYPE integer USING CASE
            WHEN "type" IS NULL THEN NULL
            WHEN jsonb_typeof("type") IN ('number', 'string') AND ("type" #>> '{}') IN (${validApplicationTypeValues.map((value) => `'${value}'`).join(", ")}) THEN ("type" #>> '{}')::integer
            ELSE NULL
        END;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE applications ALTER COLUMN "type" TYPE jsonb USING to_jsonb("type");`);
    }
}
