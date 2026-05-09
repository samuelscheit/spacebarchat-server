import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { User } from "./User";
import type { Recipient } from "./Recipient";
import { ChannelType } from "../../schemas/api/channels/Channel";
import { serializeChannelRecipients } from "../util/ChannelRecipients";

function createPublicUser(id: string, username: string) {
    return {
        id,
        username,
        discriminator: "0001",
        avatar: null,
        global_name: `${username} display`,
        public_flags: 64,
        bio: "profile bio must not leak into channel recipients",
    };
}

function createRecipient(user: ReturnType<typeof createPublicUser>) {
    return {
        user_id: user.id,
        user: {
            toPublicUser: () => user,
        } as unknown as User,
    } as unknown as Recipient;
}

function expectedPartialUser(user: ReturnType<typeof createPublicUser>) {
    const { bio: _, ...partial } = user;
    return partial;
}

describe("channel recipient serialization", () => {
    test("serializes hydrated DM recipients as public users", () => {
        const alice = createPublicUser("user-a", "alice");
        const bob = createPublicUser("user-b", "bob");
        const channel = {
            id: "channel-a",
            type: ChannelType.DM,
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            nsfw: false,
            recipients: [createRecipient(alice), createRecipient(bob)],
        };

        const recipients = serializeChannelRecipients(channel);

        assert.deepEqual(recipients, [expectedPartialUser(alice), expectedPartialUser(bob)]);
        assert.equal((recipients?.[0] as Record<string, unknown>).bio, undefined);
    });

    test("serializes hydrated group DM recipients as public users", () => {
        const alice = createPublicUser("user-a", "alice");
        const channel = {
            id: "channel-a",
            type: ChannelType.GROUP_DM,
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            nsfw: false,
            recipients: [createRecipient(alice)],
        };

        const recipients = serializeChannelRecipients(channel);

        assert.deepEqual(recipients, [expectedPartialUser(alice)]);
    });

    test("omits unhydrated DM recipients instead of leaking recipient rows", () => {
        const channel = {
            id: "channel-a",
            type: ChannelType.DM,
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            nsfw: false,
            recipients: [{ user_id: "user-a" } as Recipient],
        };

        const recipients = serializeChannelRecipients(channel);

        assert.equal(recipients, undefined);
    });

    test("serializes loaded empty DM recipient relations as an empty recipient list", () => {
        const channel = {
            id: "channel-a",
            type: ChannelType.DM,
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            nsfw: false,
            recipients: [],
        };

        const recipients = serializeChannelRecipients(channel);

        assert.deepEqual(recipients, []);
    });

    test("omits recipients when the DM recipient relation was not loaded", () => {
        const channel = {
            id: "channel-a",
            type: ChannelType.DM,
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            nsfw: false,
        };

        const recipients = serializeChannelRecipients(channel);

        assert.equal(recipients, undefined);
    });

    test("omits recipients for guild channels even if a relation property is present", () => {
        const alice = createPublicUser("user-a", "alice");
        const channel = {
            id: "channel-a",
            type: ChannelType.GUILD_TEXT,
            guild_id: "guild-a",
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            nsfw: false,
            recipients: [createRecipient(alice)],
        };

        const recipients = serializeChannelRecipients(channel);

        assert.equal(recipients, undefined);
    });
});
