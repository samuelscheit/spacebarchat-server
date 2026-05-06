/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

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

test("DiscoverableGuildsResponse uses discoverable DTOs instead of Guild entities", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.DiscoverableGuildsResponse;
    const guild = schemas.DiscoverableGuild;

    assert.equal(response.properties?.guilds?.type, "array");
    assert.equal(response.properties?.guilds?.items?.$ref, "#/definitions/DiscoverableGuild");
    assert.notEqual(response.properties?.guilds?.items?.$ref, "#/definitions/Guild");
    assert.ok(guild.properties);
    assert.equal(guild.properties.discovery_weight, undefined);
    assert.equal(guild.properties.discovery_excluded, undefined);
    assert.equal(guild.properties.discovery_splash, undefined);
    assert.equal(guild.properties.channel_ordering, undefined);
    assert.equal(guild.properties.primary_category_id, undefined);
});

test("DiscoverableGuildsResponse validates public guilds and rejects entity internals", () => {
    const response = {
        total: 1,
        guilds: [
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
        offset: 0,
        limit: 24,
    };

    assert.equal(ajv.validate("DiscoverableGuildsResponse", response), true);
    assert.equal(
        ajv.validate("DiscoverableGuildsResponse", {
            ...response,
            guilds: [{ ...response.guilds[0], discovery_splash: "hidden" }],
        }),
        false,
    );
});
