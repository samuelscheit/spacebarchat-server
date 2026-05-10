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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

type JsonSchema = {
    type?: string;
    items?: { $ref?: string };
    properties?: Record<string, JsonSchema>;
    additionalProperties?: boolean | JsonSchema;
};

describe("GravityCustomChannelScoresResponse schema", () => {
    test("describes custom score entries without requiring fabricated scores", () => {
        const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8")) as Record<string, JsonSchema>;
        const response = schemas.GravityCustomChannelScoresResponse;
        const entry = schemas.GravityCustomChannelScore;

        assert.equal(response.type, "array");
        assert.equal(response.items?.$ref, "#/definitions/GravityCustomChannelScore");
        assert.equal(entry.properties?.guild_id?.type, "string");
        assert.equal(entry.properties?.guild_score?.type, "integer");
        assert.deepEqual(entry.properties?.custom_channel_scores, { $ref: "#/definitions/GravityCustomChannelScoreMap" });
        assert.deepEqual(schemas.GravityCustomChannelScoreMap.additionalProperties, { type: "integer" });
    });
});
