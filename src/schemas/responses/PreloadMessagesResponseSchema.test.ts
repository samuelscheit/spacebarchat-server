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
    type?: string;
}

function readAssetJson<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(assetsPath, name), "utf8")) as T;
}

test("PreloadMessagesResponse schema describes preload DTOs instead of Message entities", () => {
    const schemas = readAssetJson<Record<string, JsonShape>>("schemas.json");
    const response = schemas.PreloadMessagesResponse;
    const message = schemas.PreloadMessageResponse;

    assert.equal(response.type, "array");
    assert.equal(response.items?.$ref, "#/definitions/PreloadMessageResponse");
    assert.notEqual(response.items?.$ref, "#/definitions/Message");
    assert.ok(message.properties);
    assert.equal(message.properties.reactions, undefined);
    assert.equal(message.properties.author_id, undefined);
    assert.equal(message.properties.member_id, undefined);
    assert.equal(message.properties.channel?.$ref, undefined);
});

test("PreloadMessagesResponse remains wired to POST /channels/preload-messages/", () => {
    const openapi = readAssetJson<{
        components: { schemas: Record<string, JsonShape> };
        paths: Record<
            string,
            {
                post: {
                    responses: Record<string, { content: Record<string, { schema: Record<string, string> }> }>;
                };
            }
        >;
    }>("openapi.json");

    assert.deepEqual(openapi.paths["/channels/preload-messages/"].post.responses["200"].content["application/json"].schema, {
        $ref: "#/components/schemas/PreloadMessagesResponse",
    });
    assert.equal(openapi.components.schemas.PreloadMessagesResponse.items?.$ref, "#/components/schemas/PreloadMessageResponse");
});

test("PreloadMessagesResponse validates preloaded messages and rejects reactions", () => {
    const message = {
        id: "200",
        channel_id: "100",
        author: {
            id: "300",
            username: "alice",
            discriminator: "0001",
            avatar: null,
        },
        content: "hello",
        timestamp: "2026-05-06T00:00:00.000Z",
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
    };

    assert.equal(ajv.validate("PreloadMessagesResponse", [message]), true);
    assert.equal(ajv.validate("PreloadMessagesResponse", [{ ...message, reactions: [] }]), false);
    assert.equal(ajv.validate("PreloadMessagesResponse", [{ ...message, author_id: "300" }]), false);
});
