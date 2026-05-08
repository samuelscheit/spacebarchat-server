import { MigrationInterface, QueryRunner } from "typeorm";
import { DEFAULT_DISCOVERY_CATEGORIES } from "../../util/DefaultDiscoveryCategories";

export class DefaultDiscoveryCategories1778253000000 implements MigrationInterface {
    name = "DefaultDiscoveryCategories1778253000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const valuePlaceholders = DEFAULT_DISCOVERY_CATEGORIES.map((_, index) => {
            const offset = index * 4;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}::jsonb, $${offset + 4})`;
        });
        const parameters = DEFAULT_DISCOVERY_CATEGORIES.flatMap((category) => [category.id, category.name, JSON.stringify(category.localizations), category.is_primary]);

        await queryRunner.query(`INSERT INTO categories (id, name, localizations, is_primary) VALUES ${valuePlaceholders.join(", ")} ON CONFLICT (id) DO NOTHING;`, parameters);
    }

    public async down(): Promise<void> {
        // Intentionally keep seeded rows. Guilds may reference categories(id), and operators may customize category rows after seeding.
    }
}
