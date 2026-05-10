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
    $ref?: string;
    type?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
};

describe("GravityRecommendedGuildsResponse schema", () => {
    test("describes the Gravity guild wrapper without using public guild recommendations fields", () => {
        const schemas = JSON.parse(readFileSync("assets/schemas.json", "utf8")) as Record<string, JsonSchema>;
        const response = schemas.GravityRecommendedGuildsResponse;
        const entry = schemas.GravityRecommendedGuild;

        assert.equal(response.type, "object");
        assert.equal(response.properties?.guilds?.type, "array");
        assert.equal(response.properties?.guilds?.items?.$ref, "#/definitions/GravityRecommendedGuild");
        assert.equal(response.properties?.recommended_guilds, undefined);
        assert.equal(response.properties?.load_id, undefined);
        assert.deepEqual(entry.properties?.guild, { $ref: "#/definitions/RecommendedGuild" });
    });
});
