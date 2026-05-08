import { MigrationInterface, QueryRunner } from "typeorm";

export class DiscoveryCategoryIntegerIds1778245000000 implements MigrationInterface {
    name = "DiscoveryCategoryIntegerIds1778245000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.convertDiscoveryCategoryIds(queryRunner, "integer");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await this.convertDiscoveryCategoryIds(queryRunner, "int8");
    }

    private async convertDiscoveryCategoryIds(queryRunner: QueryRunner, to: "integer" | "int8") {
        await queryRunner.query(`ALTER TABLE guilds DROP CONSTRAINT IF EXISTS guilds_categories_fk;`);

        if (to === "integer") {
            await queryRunner.query(
                `UPDATE guilds SET primary_category_id = NULL WHERE primary_category_id IS NOT NULL AND CASE WHEN primary_category_id::text ~ '^[0-9]+$' THEN primary_category_id::numeric NOT BETWEEN 0 AND 2147483647 ELSE true END;`,
            );
            await queryRunner.query(`DELETE FROM categories WHERE CASE WHEN id::text ~ '^[0-9]+$' THEN id::numeric NOT BETWEEN 0 AND 2147483647 ELSE true END;`);
        }

        await queryRunner.query(`ALTER TABLE categories ALTER COLUMN id TYPE ${to} USING id::${to};`);
        await queryRunner.query(`ALTER TABLE guilds ALTER COLUMN primary_category_id TYPE ${to} USING primary_category_id::${to};`);
        await queryRunner.query(`ALTER TABLE guilds ADD CONSTRAINT guilds_categories_fk FOREIGN KEY (primary_category_id) REFERENCES categories(id) ON DELETE SET NULL;`);
    }
}
