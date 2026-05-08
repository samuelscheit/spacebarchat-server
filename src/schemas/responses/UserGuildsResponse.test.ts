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
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ajv, nonCoercingAjv } from "../Validator";

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

test("UserGuildsResponse schema exposes with_counts fields with Discord-compatible permission strings", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.UserGuildsResponse;
    const guild = schemas.UserGuildResponse;

    assert.equal(response.type, "array");
    assert.equal(response.items?.$ref, "#/definitions/UserGuildResponse");
    assert.equal(guild.properties?.permissions?.type, "string");
    assert.equal(guild.properties?.approximate_member_count?.type, "integer");
    assert.equal(guild.properties?.approximate_presence_count?.type, "integer");
    assert.deepEqual(guild.required, ["id", "name"]);
});

test("GET /users/@me/guilds declares the user guild response schema and with_counts query metadata", () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "guilds.ts"), "utf-8");

    assert.match(routeSource, /body:\s*"UserGuildsResponse"/);
    assert.doesNotMatch(routeSource, /body:\s*"APIGuildArray"/);
    assert.match(routeSource, /with_counts:\s*{/);
    assert.match(routeSource, /type:\s*"boolean"/);
});

test("UserGuildsResponse validates default guilds and with_counts guilds", () => {
    const defaultGuild = {
        id: "100",
        name: "Example Guild",
        features: [],
        icon: null,
        owner_id: "200",
        public_updates_channel_id: null,
    };
    const countedGuild = {
        ...defaultGuild,
        approximate_member_count: 12,
        approximate_presence_count: 3,
        permissions: "2251804225",
    };

    assert.equal(ajv.validate("UserGuildsResponse", [defaultGuild, countedGuild]), true, JSON.stringify(ajv.errors, null, 2));
    assert.equal(nonCoercingAjv.validate("UserGuildsResponse", [{ ...countedGuild, permissions: 2251804225 }]), false);
});
