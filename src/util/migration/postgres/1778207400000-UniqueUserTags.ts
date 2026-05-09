import { MigrationInterface, QueryRunner } from "typeorm";
import { USERS_USERNAME_DISCRIMINATOR_INDEX } from "../../util/UserTag";

type DuplicateUserTag = {
    username: string;
    discriminator: string;
    ids: string[];
};

export class UniqueUserTags1778207400000 implements MigrationInterface {
    name = "UniqueUserTags1778207400000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const duplicates = (await queryRunner.query(`
            SELECT username, discriminator, ARRAY_AGG(id ORDER BY id) AS ids
            FROM users
            GROUP BY username, discriminator
            HAVING COUNT(*) > 1;
        `)) as DuplicateUserTag[];

        if (duplicates.length) {
            const conflicts = duplicates.map(({ username, discriminator, ids }) => `${username}#${discriminator}: ${ids.join(", ")}`).join("; ");
            throw new Error(`Cannot enforce unique user tags while duplicates exist. Resolve these users manually first: ${conflicts}`);
        }

        await queryRunner.query(`CREATE UNIQUE INDEX ${USERS_USERNAME_DISCRIMINATOR_INDEX} ON users (username, discriminator);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX ${USERS_USERNAME_DISCRIMINATOR_INDEX};`);
    }
}
