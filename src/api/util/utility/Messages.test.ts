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
import type { PartialUser, PublicMessage, PublicUser } from "@spacebar/schemas";
import { ajv } from "../../../schemas/Validator";
import { messageToPublicMessage } from "../../../util/util/MessagePublic";
import { buildMessageDeleteBulkEvent, deleteMessagesAndEmitBulkEvents, hydrateInteractionMetadataUsers, toPreloadMessageResponse } from "./Messages";

function makePublicUser(): PartialUser {
    return {
        id: "300",
        username: "alice",
        discriminator: "0001",
        avatar: null,
    };
}

function makeCompletePublicUser(overrides: Partial<PublicUser> = {}): PublicUser {
    return {
        id: "300",
        username: "alice",
        discriminator: "0001",
        public_flags: 0,
        bio: "",
        bot: false,
        premium_type: 0,
        ...overrides,
    };
}

function makeInteractionMetadata(userId = "300"): NonNullable<PublicMessage["interaction_metadata"]> {
    return { id: "901", type: 2, user_id: userId, authorizing_integration_owners: {}, name: "command", command_type: 1 };
}

function jsonRoundTrip<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function makeResolvedData(): NonNullable<PublicMessage["resolved"]> {
    return {
        users: {
            "300": makePublicUser(),
        },
        attachments: {
            "900": { id: "900", filename: "document.txt", size: 1024, url: "https://cdn.example.test/document.txt", proxy_url: "https://proxy.example.test/document.txt" },
        },
    };
}

test("messageToPublicMessage preserves optional resolved interaction data", () => {
    const resolved = makeResolvedData();
    const publicMessage = messageToPublicMessage({
        id: "200",
        channel_id: "100",
        content: "hello",
        timestamp: new Date("2026-05-06T00:00:00.000Z"),
        edited_timestamp: null,
        mentions: [],
        mention_roles: [],
        mention_channels: [],
        attachments: [],
        embeds: [],
        pinned: false,
        type: 0,
        flags: 0,
        components: [],
        author: {
            ...makePublicUser(),
            toPublicUser: makePublicUser,
        },
        resolved,
    });

    assert.deepEqual(publicMessage.resolved, resolved);
});

function makeEntityMessage(overrides: Record<string, unknown> = {}): Parameters<typeof messageToPublicMessage>[0] & Record<string, unknown> {
    return {
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
        application: {
            id: "700",
            name: "Rich Presence App",
            description: "Public app description",
            verify_key: "private-verify-key",
        },
        sticker_items: [{ id: "800", name: "wave", format_type: 1, guild_id: "400", tags: "hello,wave" }],
        interaction: { id: "900", type: 2, name: "command" },
        interaction_metadata: makeInteractionMetadata(),
        resolved: makeResolvedData(),
        author: {
            ...makePublicUser(),
            toPublicUser: makePublicUser,
        },
        ...overrides,
    } as unknown as Parameters<typeof messageToPublicMessage>[0] & Record<string, unknown>;
}

test("toPreloadMessageResponse returns a schema-compliant DTO without entity-only fields", () => {
    const entityMessage = makeEntityMessage();
    const publicMessage = messageToPublicMessage(entityMessage);

    assert.deepEqual(publicMessage.interaction, {
        id: "900",
        type: 2,
        name: "command",
    });

    const dto = toPreloadMessageResponse({ toJSON: () => publicMessage } as never);

    assert.deepEqual(dto.interaction, publicMessage.interaction);
    assert.deepEqual(publicMessage.interaction_metadata, entityMessage.interaction_metadata);
    assert.deepEqual(publicMessage.resolved, entityMessage.resolved);
    assert.deepEqual(dto.interaction_metadata, entityMessage.interaction_metadata);
    assert.deepEqual(dto.resolved, entityMessage.resolved);
    assert.equal("reactions" in dto, false);
    assert.deepEqual(dto.sticker_items, [{ id: "800", name: "wave", format_type: 1 }]);
    assert.equal((dto.sticker_items?.[0] as { guild_id?: string }).guild_id, undefined);
    assert.equal((dto.sticker_items?.[0] as { tags?: string }).tags, undefined);
    for (const field of ["guild_id", "thread_id", "pinned_at", "username", "avatar", "author_id", "member_id", "channel", "guild", "webhook"]) {
        assert.equal(Object.hasOwn(dto, field), false, `${field} should not be exposed`);
    }
    assert.deepEqual(dto.application, {
        id: "700",
        name: "Rich Presence App",
        description: "Public app description",
    });

    const serializedDto = jsonRoundTrip(dto);
    assert.equal(ajv.validate("PreloadMessagesResponse", [serializedDto]), true, ajv.errorsText());
});

test("messageToPublicMessage sanitizes interaction metadata users", () => {
    const publicUser = makeCompletePublicUser();
    const entityMessage = makeEntityMessage({
        interaction_metadata: {
            ...makeInteractionMetadata(),
            user: {
                ...publicUser,
                email: "private@example.com",
                mfa_enabled: true,
                data: { hash: "secret" },
            },
        },
    });

    const publicMessage = messageToPublicMessage(entityMessage);
    const metadataUser = publicMessage.interaction_metadata?.user as PublicUser & Record<string, unknown>;

    assert.deepEqual(metadataUser, publicUser);
    assert.equal("email" in metadataUser, false);
    assert.equal("mfa_enabled" in metadataUser, false);
    assert.equal("data" in metadataUser, false);
});

test("messageToPublicMessage omits incomplete interaction metadata", () => {
    const publicMessage = messageToPublicMessage(
        makeEntityMessage({
            interaction_metadata: { id: "901", type: 2, name: "command" },
        }),
    );

    assert.equal(publicMessage.interaction_metadata, undefined);
});

test("messageToPublicMessage serializes stored legacy interaction users as public users", () => {
    const publicUser = makePublicUser();
    const publicMessage = messageToPublicMessage(
        makeEntityMessage({
            interaction: {
                id: "900",
                type: 2,
                name: "command",
                user: {
                    id: publicUser.id,
                    username: publicUser.username,
                    discriminator: publicUser.discriminator,
                    email: "private@example.invalid",
                    phone: "private-phone",
                    verified: true,
                },
            },
        }),
    );

    assert.deepEqual(publicMessage.interaction, {
        id: "900",
        type: 2,
        name: "command",
        user: publicUser,
    });
});

test("hydrateInteractionMetadataUsers attaches public metadata users and legacy partial interaction users", async () => {
    const publicUser = makeCompletePublicUser();
    const existingUser = makeCompletePublicUser({ id: "301" });
    const messages: Array<{
        interaction?: NonNullable<PublicMessage["interaction"]>;
        interaction_metadata?: NonNullable<PublicMessage["interaction_metadata"]>;
    }> = [
        { interaction: { id: "900", type: 2, name: "command" }, interaction_metadata: makeInteractionMetadata() },
        { interaction: { id: "901", type: 2, name: "context" }, interaction_metadata: { ...makeInteractionMetadata("301"), user: existingUser } },
        {},
    ];
    const requestedUserIds: string[] = [];

    await hydrateInteractionMetadataUsers(messages, async (userId) => {
        requestedUserIds.push(userId);
        return publicUser;
    });

    assert.deepEqual(requestedUserIds, ["300"]);
    assert.deepEqual(messages[0].interaction_metadata?.user, publicUser);
    assert.deepEqual(messages[1].interaction_metadata?.user, existingUser);
    assert.deepEqual(messages[0].interaction?.user, {
        id: "300",
        username: "alice",
        discriminator: "0001",
        avatar: null,
        bot: false,
        public_flags: 0,
    });
    assert.deepEqual(messages[1].interaction?.user, {
        id: "301",
        username: "alice",
        discriminator: "0001",
        avatar: null,
        bot: false,
        public_flags: 0,
    });
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
