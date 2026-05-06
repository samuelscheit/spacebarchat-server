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

interface OpenApiShape {
    paths: Record<
        string,
        {
            get?: {
                responses?: Record<string, { content?: { "application/json"?: { schema?: JsonShape } } }>;
            };
        }
    >;
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

function createSerializedFirstMessage() {
    return {
        id: "300",
        channel_id: "400",
        author: {
            id: "200",
            username: "spacebar",
            discriminator: "0001",
            avatar: null,
        },
        content: "starter message",
        timestamp: "2026-01-02T03:04:05.000Z",
        edited_timestamp: null,
        tts: false,
        mention_everyone: false,
        mentions: [],
        mention_roles: [],
        mention_channels: [],
        attachments: [],
        embeds: [],
        pinned: false,
        type: 0,
        flags: 0,
        components: [],
        reactions: [],
        sticker_items: [],
    };
}

test("thread search route uses ThreadSearchResponse", () => {
    const openapi = readAssetJson<OpenApiShape>("openapi.json");
    const responseSchema = openapi.paths["/channels/{channel_id}/threads/search"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema;

    assert.equal(responseSchema?.$ref, "#/components/schemas/ThreadSearchResponse");
});

test("ThreadSearchResponse validates first message search payloads", () => {
    assert.equal(
        ajv.validate("ThreadSearchResponse", {
            threads: [],
            members: [],
            first_messages: [],
            total_results: 0,
            has_more: false,
        }),
        true,
    );

    const response = {
        threads: [],
        members: [
            {
                id: "100",
                user_id: "200",
                join_timestamp: "2026-01-02T03:04:05.000Z",
                flags: 0,
                muted: false,
            },
        ],
        first_messages: [createSerializedFirstMessage()],
        total_results: 1,
        has_more: false,
    };

    assert.equal(ajv.validate("ThreadSearchResponse", response), true);
    assert.equal(
        ajv.validate("ThreadSearchResponse", {
            ...response,
            members: [{ ...response.members[0], member_idx: "1" }],
        }),
        false,
    );
    assert.equal(
        ajv.validate("ThreadSearchResponse", {
            ...response,
            members: [{ ...response.members[0], index: "1" }],
        }),
        false,
    );
    assert.equal(
        ajv.validate("ThreadSearchResponse", {
            threads: [],
            members: [],
            messages: [],
            total_results: 0,
            has_more: false,
        }),
        false,
    );
});
