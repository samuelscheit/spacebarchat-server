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

export class ConversationSummaries1778404300000 implements MigrationInterface {
    name = "ConversationSummaries1778404300000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "conversation_summaries" ("id" int8 NOT NULL, "channel_id" int8 NOT NULL, "topic" character varying NOT NULL, "summ_short" character varying NOT NULL, "message_ids" int8 array NOT NULL DEFAULT ARRAY[]::int8[], "people" int8 array NOT NULL DEFAULT ARRAY[]::int8[], "unsafe" boolean NOT NULL DEFAULT false, "start_id" int8 NOT NULL, "end_id" int8 NOT NULL, "count" int4 NOT NULL, "source" int4 NOT NULL, "type" int4 NOT NULL, CONSTRAINT "PK_conversation_summaries_id" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX "IDX_conversation_summaries_channel_latest" ON "conversation_summaries" ("channel_id", "id")`);
        await queryRunner.query(
            `ALTER TABLE "conversation_summaries" ADD CONSTRAINT "FK_conversation_summaries_channel_id" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation_summaries" DROP CONSTRAINT "FK_conversation_summaries_channel_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_conversation_summaries_channel_latest"`);
        await queryRunner.query(`DROP TABLE "conversation_summaries"`);
    }
}
