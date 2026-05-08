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
import { hydrateInteractionMetadataUsers, toPreloadMessageResponse } from "./Messages";

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
        application: { id: "700" },
        sticker_items: [{ id: "800" }],
        interaction: { id: "900", type: 2, name: "command" },
        interaction_metadata: makeInteractionMetadata(),
        author: {
            ...makePublicUser(),
            toPublicUser: makePublicUser,
        },
        ...overrides,
    } as Parameters<typeof messageToPublicMessage>[0] & Record<string, unknown>;
}

test("toPreloadMessageResponse returns a schema-compliant DTO without entity-only fields", () => {
    const entityMessage = makeEntityMessage();
    const publicMessage = messageToPublicMessage(entityMessage);
    const dto = toPreloadMessageResponse({ toJSON: () => publicMessage } as never);

    assert.deepEqual(publicMessage.interaction_metadata, entityMessage.interaction_metadata);
    assert.deepEqual(dto.interaction_metadata, entityMessage.interaction_metadata);
    assert.equal("interaction" in publicMessage, false);
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
    ]) {
        assert.equal(Object.hasOwn(dto, field), false, `${field} should not be exposed`);
    }

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

test("hydrateInteractionMetadataUsers attaches public users without legacy interaction leakage", async () => {
    const publicUser = makeCompletePublicUser();
    const existingUser = makeCompletePublicUser({ id: "301" });
    const messages: Array<{ interaction_metadata?: NonNullable<PublicMessage["interaction_metadata"]> }> = [
        { interaction_metadata: makeInteractionMetadata() },
        { interaction_metadata: { ...makeInteractionMetadata("301"), user: existingUser } },
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
    assert.equal("interaction" in messages[0], false);
});
