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
import test from "node:test";
import type { PartialUser } from "@spacebar/schemas";
import { ajv } from "../../../schemas/Validator";
import { messageToPublicMessage } from "../../../util/util/MessagePublic";
import { buildMessageDeleteBulkEvent, deleteMessagesAndEmitBulkEvents, toPreloadMessageResponse } from "./Messages";

function makePublicUser(): PartialUser {
    return {
        id: "300",
        username: "alice",
        discriminator: "0001",
        avatar: null,
    };
}

function jsonRoundTrip<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

test("toPreloadMessageResponse returns a schema-compliant DTO without entity-only fields", () => {
    const entityMessage = {
        id: "200",
        channel_id: "100",
        guild_id: "400",
        thread_id: "500",
        author_id: "300",
        member_id: "300",
        content: "hello",
        timestamp: new Date("2026-05-06T00:00:00.000Z"),
        edited_timestamp: null,
        tts: false,
        mention_everyone: false,
        mentions: [],
        mention_roles: [],
        mention_channels: [],
        attachments: [],
        embeds: [],
        reactions: [{ count: 1, emoji: { name: "👋" }, user_ids: ["300"] }],
        pinned_at: new Date("2026-05-06T00:01:00.000Z"),
        pinned: true,
        type: 0,
        flags: 0,
        components: [],
        message_snapshots: [],
        username: "webhook-name",
        avatar: "webhook-avatar",
        channel: { id: "100" },
        guild: { id: "400" },
        webhook: { id: "600" },
        application: { id: "700" },
        sticker_items: [{ id: "800" }],
        interaction: { id: "900", type: 2, name: "command" },
        interaction_metadata: { id: "901", type: 2, user_id: "300", authorizing_integration_owners: {}, name: "command", command_type: 1 },
        author: {
            ...makePublicUser(),
            toPublicUser: makePublicUser,
        },
    } as Parameters<typeof messageToPublicMessage>[0] & Record<string, unknown>;

    const publicMessage = messageToPublicMessage(entityMessage);
    const dto = toPreloadMessageResponse({ toJSON: () => publicMessage } as never);

    assert.equal("reactions" in dto, false);
    for (const field of [
        "guild_id",
        "thread_id",
        "pinned_at",
        "username",
        "avatar",
        "author_id",
        "member_id",
        "channel",
        "guild",
        "webhook",
        "application",
        "sticker_items",
        "interaction",
        "interaction_metadata",
    ]) {
        assert.equal(Object.hasOwn(dto, field), false, `${field} should not be exposed`);
    }

    const serializedDto = jsonRoundTrip(dto);
    assert.equal(ajv.validate("PreloadMessagesResponse", [serializedDto]), true, ajv.errorsText());
});

test("buildMessageDeleteBulkEvent builds MESSAGE_DELETE_BULK payloads with guild ids", () => {
    assert.deepEqual(
        buildMessageDeleteBulkEvent({
            ids: ["1", "2"],
            channel_id: "channel",
            guild_id: "guild",
        }),
        {
            event: "MESSAGE_DELETE_BULK",
            channel_id: "channel",
            data: {
                ids: ["1", "2"],
                channel_id: "channel",
                guild_id: "guild",
            },
        },
    );
});

test("deleteMessagesAndEmitBulkEvents deletes and emits ids in bounded chunks", async () => {
    const deleted: string[][] = [];
    const emitted: string[][] = [];

    const count = await deleteMessagesAndEmitBulkEvents(
        {
            ids: ["1", "2", "3", "4", "5"],
            channel_id: "channel",
            guild_id: "guild",
        },
        {
            chunkSize: 2,
            deleteMessageIds: async (ids) => {
                deleted.push(ids);
            },
            emit: async (event) => {
                emitted.push(event.data.ids);
                assert.equal(event.data.channel_id, "channel");
                assert.equal(event.data.guild_id, "guild");
            },
        },
    );

    assert.equal(count, 5);
    assert.deepEqual(deleted, [["1", "2"], ["3", "4"], ["5"]]);
    assert.deepEqual(emitted, deleted);
});

test("deleteMessagesAndEmitBulkEvents does not delete or emit for empty id lists", async () => {
    let deleteCalls = 0;
    let emitCalls = 0;

    const count = await deleteMessagesAndEmitBulkEvents(
        {
            ids: [],
            channel_id: "channel",
        },
        {
            chunkSize: 2,
            deleteMessageIds: async () => {
                deleteCalls += 1;
            },
            emit: async () => {
                emitCalls += 1;
            },
        },
    );

    assert.equal(count, 0);
    assert.equal(deleteCalls, 0);
    assert.equal(emitCalls, 0);
});

test("deleteMessagesAndEmitBulkEvents rejects invalid chunk sizes", async () => {
    await assert.rejects(
        deleteMessagesAndEmitBulkEvents(
            {
                ids: ["1"],
                channel_id: "channel",
            },
            {
                chunkSize: 0,
                deleteMessageIds: async () => undefined,
            },
        ),
        /chunkSize must be a positive integer/,
    );
});
