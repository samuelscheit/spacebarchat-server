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
import { ajv } from "../Validator";

const assetsPath = path.join(process.cwd(), "assets");

interface JsonShape {
    $ref?: string;
    items?: JsonShape;
    properties?: Record<string, JsonShape>;
    type?: string | string[];
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("GuildMessagesSearchResponse uses grouped message DTOs without Role entities", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.GuildMessagesSearchResponse;
    const searchMessage = schemas.GuildMessagesSearchMessage;

    assert.equal(response.properties?.messages?.type, "array");
    assert.equal(response.properties?.messages?.items?.type, "array");
    assert.equal(response.properties?.messages?.items?.items?.$ref, "#/definitions/GuildMessagesSearchMessage");
    const mentionRoles = searchMessage.properties?.mention_roles;
    const mentionRoleItems = mentionRoles?.items;

    assert.deepEqual(mentionRoles, {
        type: "array",
        items: { type: "string" },
    });
    assert.notEqual(mentionRoleItems?.$ref, "#/definitions/Role");
});

test("GuildMessagesSearchResponse validates grouped search hits", () => {
    const response = {
        messages: [
            [
                {
                    id: "200",
                    type: 0,
                    content: "",
                    channel_id: "300",
                    author: {
                        id: "100",
                        username: "author",
                        discriminator: "0001",
                        public_flags: 0,
                        bio: "",
                        bot: false,
                        premium_since: "2026-01-01T00:00:00.000Z",
                        premium_type: 0,
                    },
                    attachments: [],
                    embeds: [],
                    mentions: [],
                    mention_roles: ["500"],
                    pinned: false,
                    mention_everyone: false,
                    tts: false,
                    timestamp: "2026-01-02T03:04:05.000Z",
                    edited_timestamp: null,
                    flags: 0,
                    hit: true,
                },
            ],
        ],
        total_results: 1,
    };

    assert.equal(ajv.validate("GuildMessagesSearchResponse", response), true);
    assert.equal(
        ajv.validate("GuildMessagesSearchResponse", {
            ...response,
            messages: [{ ...response.messages[0][0], mention_roles: [{ id: "500" }] }],
        }),
        false,
    );
});
