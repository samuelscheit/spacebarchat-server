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
    anyOf?: JsonShape[];
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    required?: string[];
    type?: string;
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("EmojiSourceResponse schema describes the emoji source DTO instead of the Emoji entity", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const emojiGuild = schemas.EmojiGuild;
    const emoji = schemas.EmojiResponse;

    assert.ok(emojiGuild.properties?.emojis.items);
    assert.ok(emoji.properties);
    assert.equal(emojiGuild.properties.emojis.items.$ref, "#/definitions/EmojiResponse");
    assert.notEqual(emojiGuild.properties.emojis.items.$ref, "#/definitions/Emoji");
    assert.equal(emoji.properties.guild_id, undefined);
    assert.equal(emoji.properties.guild, undefined);
    assert.equal(emoji.properties.groups, undefined);
    assert.equal(emoji.properties.user_id, undefined);
    assert.deepEqual(emoji.required, ["id", "name"]);
});

test("EmojiSourceResponse remains wired to GET /emojis/{emoji_id}/source", () => {
    const openapi = readAssetJson<{
        components: { schemas: Record<string, JsonShape> };
        paths: Record<
            string,
            {
                get: {
                    responses: Record<string, { content: Record<string, { schema: Record<string, string> }> }>;
                };
            }
        >;
    }>("openapi.json");

    assert.deepEqual(openapi.paths["/emojis/{emoji_id}/source/"].get.responses["200"].content["application/json"].schema, {
        $ref: "#/components/schemas/EmojiSourceResponse",
    });
    assert.equal(openapi.components.schemas.EmojiGuild.properties?.emojis.items?.$ref, "#/components/schemas/EmojiResponse");
    assert.notEqual(openapi.components.schemas.EmojiGuild.properties?.emojis.items?.$ref, "#/components/schemas/Emoji");
});

test("EmojiSourceResponse validates route-shaped guild sources and rejects entity relations", () => {
    const routeShapedSource = {
        type: "GUILD",
        guild: {
            id: "100",
            name: "Example Guild",
            icon: null,
            description: null,
            features: [],
            emojis: [
                {
                    id: "200",
                    name: "wave",
                    animated: false,
                    available: true,
                    managed: false,
                    require_colons: true,
                    roles: [],
                },
            ],
            premium_tier: 0,
            premium_subscription_count: null,
            approximate_member_count: 1,
            approximate_presence_count: 0,
        },
    };

    assert.equal(ajv.validate("EmojiSourceResponse", routeShapedSource), true);
    assert.equal(
        ajv.validate("EmojiSourceResponse", {
            ...routeShapedSource,
            guild: {
                ...routeShapedSource.guild,
                emojis: [
                    {
                        ...routeShapedSource.guild.emojis[0],
                        guild_id: "100",
                    },
                ],
            },
        }),
        false,
    );
});
