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

export class ApplicationStoreAssets1778442600000 implements MigrationInterface {
    name = "ApplicationStoreAssets1778442600000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE application_store_assets (
                id int8 NOT NULL,
                application_id int8 NOT NULL,
                size integer NOT NULL,
                mime_type character varying NOT NULL,
                filename character varying NOT NULL,
                width integer NOT NULL,
                height integer NOT NULL,
                CONSTRAINT "PK_application_store_assets_id" PRIMARY KEY (id),
                CONSTRAINT "FK_application_store_assets_application_id" FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
            );
        `);
        await queryRunner.query(`CREATE INDEX "IDX_application_store_assets_application_id" ON application_store_assets (application_id);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_application_store_assets_application_id";`);
        await queryRunner.query(`DROP TABLE application_store_assets;`);
    }
}
