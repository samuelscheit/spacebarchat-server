/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { MigrationInterface, QueryRunner } from "typeorm";

export class ApplicationEmojis1778418600000 implements MigrationInterface {
    name = "ApplicationEmojis1778418600000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE application_emojis (
                id int8 NOT NULL,
                application_id int8 NOT NULL,
                user_id int8,
                name character varying NOT NULL,
                animated boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_application_emojis_id" PRIMARY KEY (id),
                CONSTRAINT "FK_application_emojis_application_id" FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
                CONSTRAINT "FK_application_emojis_user_id" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT "UQ_application_emojis_application_id_name" UNIQUE (application_id, name)
            );
        `);
        await queryRunner.query(`CREATE INDEX "IDX_application_emojis_application_id" ON application_emojis (application_id);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_application_emojis_application_id";`);
        await queryRunner.query(`DROP TABLE application_emojis;`);
    }
}
