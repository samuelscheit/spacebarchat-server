/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERMERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ajv } from "../Validator";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("GuildRecommendationsResponse uses recommendation DTOs instead of Guild entities", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.GuildRecommendationsResponse;
    const recommendedGuild = schemas.RecommendedGuild;

    assert.equal(response.properties?.recommended_guilds?.type, "array");
    assert.equal(response.properties?.recommended_guilds?.items?.$ref, "#/definitions/RecommendedGuild");
    assert.notEqual(response.properties?.recommended_guilds?.items?.$ref, "#/definitions/Guild");
    assert.ok(recommendedGuild.properties);
    assert.equal(recommendedGuild.properties.discovery_weight, undefined);
    assert.equal(recommendedGuild.properties.discovery_excluded, undefined);
    assert.equal(recommendedGuild.properties.channel_ordering, undefined);
    assert.equal(recommendedGuild.properties.template_id, undefined);
});

test("GuildRecommendationsResponse validates recommendation payloads and rejects entity internals", () => {
    const response = {
        recommended_guilds: [
            {
                id: "100",
                name: "Discoverable guild",
                icon: null,
                banner: null,
                splash: null,
                description: null,
                features: ["DISCOVERABLE"],
                widget_enabled: true,
                welcome_screen: {
                    enabled: false,
                    description: "",
                    welcome_channels: [],
                },
            },
        ],
        load_id: "server_recs/0123456789abcdef0123456789abcdef",
    };

    assert.equal(ajv.validate("GuildRecommendationsResponse", response), true);
    assert.equal(
        ajv.validate("GuildRecommendationsResponse", {
            ...response,
            recommended_guilds: [{ ...response.recommended_guilds[0], discovery_weight: 1 }],
        }),
        false,
    );
});
