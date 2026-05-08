import assert from "node:assert/strict";
import { describe, test } from "node:test";

process.env.DATABASE ??= "postgres://user:password@localhost:5432/test";

const { Channel } = require("@spacebar/util") as typeof import("@spacebar/util");
const { ChannelType } = require("@spacebar/schemas") as typeof import("@spacebar/schemas");

type UtilModule = typeof import("@spacebar/util");
type ChannelEntity = import("@spacebar/util").Channel;
type RecipientEntity = InstanceType<UtilModule["Recipient"]>;
type GuildEntity = InstanceType<UtilModule["Guild"]>;

function channelWith(fields: Partial<ChannelEntity>) {
    return Object.assign(new Channel(), fields);
}

function recipient(user_id: string, closed: boolean) {
    return { user_id, closed } as unknown as RecipientEntity;
}

function guild(id: string, owner_id: string) {
    return { id, owner_id } as unknown as GuildEntity;
}

describe("Channel.canViewChannel", () => {
    test("fails closed instead of throwing when a DM channel has no caller user", async () => {
        const channel = channelWith({ id: "dm", type: ChannelType.DM });
        const errors: unknown[][] = [];
        const originalError = console.error;

        try {
            console.error = (...args: unknown[]) => {
                errors.push(args);
            };

            assert.equal(await channel.canViewChannel({}), false);
        } finally {
            console.error = originalError;
        }

        assert.deepEqual(errors, [["Channel.canViewChannel: called without user for DM channel."]]);
    });

    test("allows an open DM recipient identified only by user_id", async () => {
        const channel = channelWith({
            id: "dm",
            type: ChannelType.DM,
            recipients: [recipient("recipient", false)],
        });

        assert.equal(await channel.canViewChannel({ user_id: "recipient" }), true);
    });

    test("denies a closed DM recipient identified only by user_id", async () => {
        const channel = channelWith({
            id: "dm",
            type: ChannelType.DM,
            recipients: [recipient("recipient", true)],
        });

        assert.equal(await channel.canViewChannel({ user_id: "recipient" }), false);
    });

    test("denies a DM user_id that is not a recipient", async () => {
        const channel = channelWith({
            id: "dm",
            type: ChannelType.DM,
            recipients: [recipient("recipient", false)],
        });

        assert.equal(await channel.canViewChannel({ user_id: "outsider" }), false);
    });

    test("fails closed instead of throwing when a guild channel lacks guild context", async () => {
        const channel = channelWith({ id: "guild-channel", type: ChannelType.GUILD_TEXT });
        const errors: unknown[][] = [];
        const originalError = console.error;

        try {
            console.error = (...args: unknown[]) => {
                errors.push(args);
            };

            assert.equal(await channel.canViewChannel({ user_id: "user" }), false);
        } finally {
            console.error = originalError;
        }

        assert.deepEqual(errors, [["Channel.getUserPermissions: called without guild for non-DM channel."]]);
    });

    test("fails closed instead of throwing when a guild channel lacks user or member context", async () => {
        const channel = channelWith({ id: "guild-channel", type: ChannelType.GUILD_TEXT, guild: guild("guild", "owner") });
        const errors: unknown[][] = [];
        const originalError = console.error;

        try {
            console.error = (...args: unknown[]) => {
                errors.push(args);
            };

            assert.equal(await channel.canViewChannel({}), false);
        } finally {
            console.error = originalError;
        }

        assert.deepEqual(errors, [["Channel.getUserPermissions: called without user or member for non-DM channel."]]);
    });
});
