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

interface OpenApiHttpResult {
    content?: {
        "application/json"?: {
            schema?: JsonShape;
        };
    };
}

interface OpenApiOperation {
    responses?: Record<string, OpenApiHttpResult>;
}

interface OpenApiDocument {
    paths: Record<string, { get?: OpenApiOperation }>;
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("ChannelThreadsSearchResponse documents thread search with flat messages", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const openapi = readAssetJson<OpenApiDocument>("openapi.json");
    const response = schemas.ChannelThreadsSearchResponse;
    const routeSchema = openapi.paths["/channels/{channel_id}/threads/search"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema;

    assert.deepEqual(routeSchema, { $ref: "#/components/schemas/ChannelThreadsSearchResponse" });
    assert.equal(response.properties?.messages?.type, "array");
    assert.equal(response.properties?.messages?.items?.$ref, "#/definitions/PublicMessage");
    assert.notEqual(response.properties?.messages?.items?.$ref, "#/definitions/GuildMessagesSearchMessage");
    assert.equal(schemas.GuildMessagesSearchResponse.properties?.messages?.items?.type, "array");
});

test("ChannelThreadsSearchResponse validates flat thread search results", () => {
    const response = {
        threads: [],
        members: [
            {
                index: 1,
                id: "300",
                member_idx: 2,
                join_timestamp: "2026-01-02T03:04:05.000Z",
                muted: false,
                flags: 0,
            },
        ],
        messages: [
            {
                id: "200",
                channel_id: "300",
                author: {
                    id: "100",
                    username: "author",
                    discriminator: "0001",
                    avatar: null,
                },
                content: "thread starter",
                timestamp: "2026-01-02T03:04:05.000Z",
                edited_timestamp: null,
                tts: false,
                mention_everyone: false,
                mentions: [],
                mention_roles: [],
                attachments: [],
                embeds: [],
                pinned: false,
                type: 0,
                flags: 0,
                components: [],
            },
        ],
        total_results: 0,
        has_more: false,
    };

    assert.equal(ajv.validate("ChannelThreadsSearchResponse", response), true);
    assert.equal(
        ajv.validate("ChannelThreadsSearchResponse", {
            ...response,
            messages: [[]],
        }),
        false,
    );
    assert.equal(
        ajv.validate("ChannelThreadsSearchResponse", {
            ...response,
            members: [{ ...response.members[0], index: "one", member_idx: "two" }],
        }),
        false,
    );
});
