import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { User } from "./User";

const enum TestChannelType {
    GUILD_TEXT = 0,
    DM = 1,
}

function createPublicUser(id: string, username: string) {
    return {
        id,
        username,
        discriminator: "0001",
        avatar: null,
    };
}

function createRecipient(user: ReturnType<typeof createPublicUser>) {
    return {
        user_id: user.id,
        user: {
            toPublicUser: () => user,
        } as unknown as User,
    };
}

describe("Channel.toJSON recipient serialization", () => {
    test("serializes hydrated DM recipients as public users", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-tests";
        const { Channel } = await import("./Channel.js");
        const alice = createPublicUser("user-a", "alice");
        const bob = createPublicUser("user-b", "bob");
        const channel = new Channel();
        Object.assign(channel, {
            id: "channel-a",
            type: TestChannelType.DM,
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            nsfw: false,
            recipients: [createRecipient(alice), createRecipient(bob)],
        });

        const json = channel.toJSON();

        assert.deepEqual(json.recipients, [alice, bob]);
    });

    test("omits unhydrated DM recipients instead of leaking recipient rows", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-tests";
        const { Channel } = await import("./Channel.js");
        const channel = new Channel();
        Object.assign(channel, {
            id: "channel-a",
            type: TestChannelType.DM,
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            nsfw: false,
            recipients: [{ user_id: "user-a" }],
        });

        const json = channel.toJSON();

        assert.equal(json.recipients, undefined);
    });

    test("omits recipients for guild channels even if a relation property is present", async () => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar-tests";
        const { Channel } = await import("./Channel.js");
        const alice = createPublicUser("user-a", "alice");
        const channel = new Channel();
        Object.assign(channel, {
            id: "channel-a",
            type: TestChannelType.GUILD_TEXT,
            guild_id: "guild-a",
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            nsfw: false,
            recipients: [createRecipient(alice)],
        });

        const json = channel.toJSON();

        assert.equal(json.recipients, undefined);
    });
});
