import { MigrationInterface, QueryRunner } from "typeorm";

export class ApplicationCommandNameLocalizationsJsonb1778280300000 implements MigrationInterface {
    name = "ApplicationCommandNameLocalizationsJsonb1778280300000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE application_commands ALTER COLUMN name_localizations TYPE jsonb USING name_localizations::jsonb;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE application_commands ALTER COLUMN name_localizations TYPE varchar USING name_localizations::varchar;`);
    }
}
