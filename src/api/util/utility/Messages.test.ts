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
import { toPreloadMessageResponse } from "./Messages";

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

    assert.deepEqual(publicMessage.interaction, {
        id: "900",
        type: 2,
        name: "command",
    });

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
        "interaction_metadata",
    ]) {
        assert.equal(Object.hasOwn(dto, field), false, `${field} should not be exposed`);
    }

    const serializedDto = jsonRoundTrip(dto);
    assert.equal(ajv.validate("PreloadMessagesResponse", [serializedDto]), true, ajv.errorsText());
});


test("messageToPublicMessage serializes legacy interaction users as public users", () => {
    const publicUser = makePublicUser();
    const entityMessage = {
        id: "201",
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
        type: 20,
        flags: 0,
        components: [],
        interaction: {
            id: "900",
            type: 2,
            name: "command",
            user: {
                ...publicUser,
                email: "private@example.invalid",
                toPublicUser: () => publicUser,
            },
        },
        author: {
            ...makePublicUser(),
            toPublicUser: makePublicUser,
        },
    } as Parameters<typeof messageToPublicMessage>[0] & Record<string, unknown>;

    const publicMessage = messageToPublicMessage(entityMessage);

    assert.deepEqual(publicMessage.interaction, {
        id: "900",
        type: 2,
        name: "command",
        user: publicUser,
    });
});
