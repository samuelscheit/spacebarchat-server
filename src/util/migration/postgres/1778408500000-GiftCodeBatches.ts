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

export class GiftCodeBatches1778408500000 implements MigrationInterface {
    name = "GiftCodeBatches1778408500000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE gift_code_batches (
            id int8 NOT NULL,
            application_id int8 NOT NULL,
            sku_id int8 NOT NULL,
            amount integer NOT NULL,
            description varchar,
            entitlement_branches varchar array,
            entitlement_starts_at timestamp without time zone,
            entitlement_ends_at timestamp without time zone,
            CONSTRAINT "PK_gift_code_batches_id" PRIMARY KEY (id),
            CONSTRAINT gift_code_batches_applications_fk FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
        );`);
        await queryRunner.query(`CREATE INDEX "IDX_gift_code_batches_application_id" ON gift_code_batches (application_id);`);

        await queryRunner.query(`CREATE TABLE gift_codes (
            code varchar NOT NULL,
            sku_id int8 NOT NULL,
            application_id int8 NOT NULL,
            batch_id int8,
            uses integer NOT NULL DEFAULT 0,
            max_uses integer NOT NULL DEFAULT 1,
            expires_at timestamp without time zone,
            entitlement_branches varchar array,
            gift_style integer,
            CONSTRAINT "PK_gift_codes_code" PRIMARY KEY (code),
            CONSTRAINT gift_codes_applications_fk FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
            CONSTRAINT gift_codes_batches_fk FOREIGN KEY (batch_id) REFERENCES gift_code_batches(id) ON DELETE CASCADE
        );`);
        await queryRunner.query(`CREATE INDEX "IDX_gift_codes_application_id" ON gift_codes (application_id);`);
        await queryRunner.query(`CREATE INDEX "IDX_gift_codes_batch_id" ON gift_codes (batch_id);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_gift_codes_batch_id";`);
        await queryRunner.query(`DROP INDEX "IDX_gift_codes_application_id";`);
        await queryRunner.query(`DROP TABLE gift_codes;`);
        await queryRunner.query(`DROP INDEX "IDX_gift_code_batches_application_id";`);
        await queryRunner.query(`DROP TABLE gift_code_batches;`);
    }
}
