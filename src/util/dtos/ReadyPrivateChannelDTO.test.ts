import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ChannelType, PublicUser } from "@spacebar/schemas";
import { serializeReadyPrivateChannel, type ReadyPrivateChannelSource } from "./ReadyPrivateChannelDTO";

const DM_CHANNEL_TYPE = 1 as ChannelType.DM;
const GROUP_DM_CHANNEL_TYPE = 3 as ChannelType.GROUP_DM;

function publicUser(id: string): PublicUser {
    return {
        id,
        username: id,
        discriminator: "0000",
        public_flags: 0,
    } as PublicUser;
}

function recipient(id: string) {
    return {
        user: {
            id,
            toPublicUser: () => publicUser(id),
        },
    };
}

describe("serializeReadyPrivateChannel", () => {
    test("serializes READY compatibility is_spam without a persisted channel field", () => {
        const source: ReadyPrivateChannelSource = {
            id: "channel-id",
            flags: 32,
            icon: null,
            last_message_id: "message-id",
            name: null,
            owner_id: null,
            recipients: [recipient("current-user"), recipient("friend-user")],
            type: DM_CHANNEL_TYPE,
        };

        assert.equal("is_spam" in source, false);

        const serialized = serializeReadyPrivateChannel(source, "current-user", publicUser("current-user"));

        assert.equal(serialized.channel.is_spam, false);
        assert.equal("is_spam" in source, false);
        assert.deepEqual(
            serialized.channel.recipients.map((user) => user.id),
            ["friend-user"],
        );
        assert.deepEqual(
            serialized.users.map((user) => user.id),
            ["friend-user"],
        );
        assert.equal(source.recipients?.length, 2);
    });

    test("keeps orphaned one-to-one DMs visible to the current user", () => {
        const currentUser = publicUser("current-user");

        const serialized = serializeReadyPrivateChannel(
            {
                id: "orphaned-dm",
                flags: 0,
                last_message_id: null,
                recipients: [],
                type: DM_CHANNEL_TYPE,
            },
            "current-user",
            currentUser,
        );

        assert.deepEqual(serialized.channel.recipients, [currentUser]);
        assert.deepEqual(serialized.users, [currentUser]);
        assert.equal(serialized.channel.last_message_id, null);
    });

    test("does not inject the current user into empty group DMs", () => {
        const serialized = serializeReadyPrivateChannel(
            {
                id: "empty-group-dm",
                flags: 0,
                recipients: [],
                type: GROUP_DM_CHANNEL_TYPE,
            },
            "current-user",
            publicUser("current-user"),
        );

        assert.deepEqual(serialized.channel.recipients, []);
        assert.deepEqual(serialized.users, []);
    });
});
