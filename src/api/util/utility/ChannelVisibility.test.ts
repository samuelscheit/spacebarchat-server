import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { HTTPError } from "lambert-server";
import {
    assertGuildMember,
    ChannelPermissionResolver,
    ChannelVisibilityTarget,
    filterViewableChannels,
    getChannelIdSetWithPermissions,
    hasChannelPermissions,
} from "./ChannelVisibility";

function permissions(...allowed: string[]) {
    return {
        has(permission: unknown) {
            return typeof permission === "string" && allowed.includes(permission);
        },
    };
}

describe("ChannelVisibility", () => {
    test("assertGuildMember rejects non-members", async () => {
        await assert.doesNotReject(() => assertGuildMember("member", "guild", async () => true));

        await assert.rejects(
            () => assertGuildMember("outsider", "guild", async () => false),
            (error) => {
                assert.equal(error instanceof HTTPError, true);
                assert.equal((error as HTTPError).code, 403);
                return true;
            },
        );
    });

    test("filterViewableChannels excludes members denied by channel overwrites", async () => {
        const channels: ChannelVisibilityTarget[] = [
            { id: "public", guild_id: "guild" },
            { id: "private", guild_id: "guild" },
        ];
        const resolvePermission: ChannelPermissionResolver = async (_userId, _guildId, channel) => (channel.id === "private" ? permissions() : permissions("VIEW_CHANNEL"));

        const visible = await filterViewableChannels("member", channels, resolvePermission);

        assert.deepEqual(
            visible.map((channel) => channel.id),
            ["public"],
        );
    });

    test("hasChannelPermissions requires every requested permission", async () => {
        const channel: ChannelVisibilityTarget = { id: "channel", guild_id: "guild" };
        const resolvePermission: ChannelPermissionResolver = async () => permissions("VIEW_CHANNEL");

        assert.equal(await hasChannelPermissions("member", channel, ["VIEW_CHANNEL"], resolvePermission), true);
        assert.equal(await hasChannelPermissions("member", channel, ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"], resolvePermission), false);
        assert.equal(await hasChannelPermissions(undefined, channel, ["VIEW_CHANNEL"], resolvePermission), false);
    });

    test("getChannelIdSetWithPermissions resolves only known channels with required permissions", async () => {
        const lookupCalls: string[][] = [];
        const permissionCalls: string[] = [];

        const ids = await getChannelIdSetWithPermissions("member", ["visible", "no-history", "missing", "visible"], {
            requiredPermissions: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"],
            findChannelsById: async (channelIds) => {
                lookupCalls.push(channelIds);
                return [
                    { id: "visible", guild_id: "guild" },
                    { id: "no-history", guild_id: "guild" },
                ];
            },
            resolvePermission: async (_userId, _guildId, channel) => {
                permissionCalls.push(channel.id);
                return channel.id === "visible" ? permissions("VIEW_CHANNEL", "READ_MESSAGE_HISTORY") : permissions("VIEW_CHANNEL");
            },
        });

        assert.deepEqual(lookupCalls, [["visible", "no-history", "missing"]]);
        assert.deepEqual(permissionCalls, ["visible", "no-history"]);
        assert.deepEqual([...ids], ["visible"]);
    });

    test("permission misses are hidden while unexpected resolver errors propagate", async () => {
        const hidden = await hasChannelPermissions("member", { id: "unknown", guild_id: "guild" }, ["VIEW_CHANNEL"], async () => {
            const error = new Error("not found");
            error.name = "EntityNotFoundError";
            throw error;
        });

        assert.equal(hidden, false);
        await assert.rejects(
            () =>
                hasChannelPermissions("member", { id: "broken", guild_id: "guild" }, ["VIEW_CHANNEL"], async () => {
                    throw new Error("database offline");
                }),
            /database offline/,
        );
    });
});
