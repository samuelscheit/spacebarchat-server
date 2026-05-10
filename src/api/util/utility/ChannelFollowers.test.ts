import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { WebhookType } from "../../../schemas/api/channels/Webhook";
import {
    assertChannelSupportsFollowerStats,
    assertChannelFollowerWebhookLimit,
    ChannelFollowerChannelType,
    ChannelFollowerWebhook,
    ChannelFollowerPermissionResolver,
    createChannelFollowerStatsResponse,
    createChannelFollowerWebhookPayload,
    createFollowedChannelResponse,
    getChannelFollowerStatsGuildIds,
    followAnnouncementChannel,
    validateChannelFollowerChannels,
} from "./ChannelFollowers";

const source = {
    id: "source-channel",
    guild_id: "source-guild",
    name: "announcements",
    type: ChannelFollowerChannelType.GuildNews,
};

const target = {
    id: "target-channel",
    guild_id: "target-guild",
    type: ChannelFollowerChannelType.GuildText,
};

function createPermissionResolver(blocked: Record<string, ("VIEW_CHANNEL" | "MANAGE_WEBHOOKS")[]> = {}) {
    const calls: string[] = [];

    const getChannelPermission: ChannelFollowerPermissionResolver = async (userId, guildId, channel) => {
        calls.push(`resolve:${userId}:${guildId}:${channel.id}`);

        return {
            hasThrow(permission) {
                calls.push(`check:${channel.id}:${permission}`);

                if (blocked[channel.id]?.includes(permission)) {
                    throw new Error(`${channel.id} missing ${permission}`);
                }
            },
        };
    };

    return { calls, getChannelPermission };
}

describe("ChannelFollowers", () => {
    test("accepts announcement source channels and guild text target channels", () => {
        assert.equal(validateChannelFollowerChannels(source, target), undefined);
    });

    test("rejects non-announcement source channels", () => {
        assert.throws(() => validateChannelFollowerChannels({ ...source, type: ChannelFollowerChannelType.GuildText }, target));
    });

    test("rejects non-guild target channels", () => {
        assert.throws(() => validateChannelFollowerChannels(source, { ...target, guild_id: null }));
    });

    test("rejects voice target channels", () => {
        assert.throws(() => validateChannelFollowerChannels(source, { ...target, type: ChannelFollowerChannelType.GuildVoice }));
    });

    test("accepts follower stats only for announcement source channels", () => {
        assert.equal(assertChannelSupportsFollowerStats(source), undefined);
        assert.throws(() => assertChannelSupportsFollowerStats({ ...source, type: ChannelFollowerChannelType.GuildText }));
        assert.throws(() => assertChannelSupportsFollowerStats({ ...source, guild_id: null }));
    });

    test("enforces destination webhook limit", () => {
        assert.equal(assertChannelFollowerWebhookLimit(9, 10), undefined);
        assert.throws(() => assertChannelFollowerWebhookLimit(10, 10));
    });

    test("builds a channel follower webhook payload", () => {
        assert.deepEqual(createChannelFollowerWebhookPayload(source, target, "user-id"), {
            type: WebhookType.ChannelFollower,
            name: "announcements",
            guild_id: "target-guild",
            channel_id: "target-channel",
            user_id: "user-id",
            source_guild_id: "source-guild",
            source_channel_id: "source-channel",
        });
    });

    test("builds the followed channel response", () => {
        assert.deepEqual(createFollowedChannelResponse("target-channel", "webhook-id"), {
            channel_id: "target-channel",
            webhook_id: "webhook-id",
        });
    });

    test("builds follower stats from known follower webhooks and zeroes unsupported history metrics", () => {
        const followerWebhooks = [
            { channel_id: "target-channel-a", guild_id: "target-guild-a" },
            { channel_id: "target-channel-a", guild_id: "target-guild-a" },
            { channel_id: "target-channel-b", guild_id: "target-guild-a" },
            { channel_id: "target-channel-c", guild_id: "target-guild-b" },
            { channel_id: null, guild_id: null },
        ];

        assert.deepEqual(getChannelFollowerStatsGuildIds(followerWebhooks), ["target-guild-a", "target-guild-b"]);
        assert.deepEqual(createChannelFollowerStatsResponse(followerWebhooks, 123), {
            channels_following: 3,
            guild_members: 123,
            guilds_following: 2,
            users_seen_ever: 0,
            subscribers_gained_since_last_post: 0,
            subscribers_lost_since_last_post: 0,
        });
    });

    test("rejects following when the user cannot view the source announcement channel before creating a webhook", async () => {
        const { calls, getChannelPermission } = createPermissionResolver({
            [source.id]: ["VIEW_CHANNEL"],
        });

        await assert.rejects(
            () =>
                followAnnouncementChannel({
                    userId: "user-id",
                    sourceChannel: source,
                    targetChannel: target,
                    getChannelPermission,
                    countTargetWebhooks: async () => {
                        calls.push("count");
                        return 0;
                    },
                    maxWebhooks: 10,
                    createWebhook: async (payload) => {
                        calls.push(`create:${payload.channel_id}`);
                        return { id: "webhook-id", channel_id: payload.channel_id };
                    },
                }),
            /source-channel missing VIEW_CHANNEL/,
        );

        assert.deepEqual(
            calls.filter((call) => call.startsWith("check:")),
            ["check:source-channel:VIEW_CHANNEL"],
        );
        assert.equal(calls.includes("count"), false);
        assert.equal(
            calls.some((call) => call.startsWith("create:")),
            false,
        );
    });

    test("creates a follower webhook when the user can view the source and manage target webhooks", async () => {
        const { calls, getChannelPermission } = createPermissionResolver();
        const createdPayloads: ChannelFollowerWebhook[] = [];

        const response = await followAnnouncementChannel({
            userId: "user-id",
            sourceChannel: source,
            targetChannel: target,
            getChannelPermission,
            countTargetWebhooks: async (channelId) => {
                calls.push(`count:${channelId}`);
                return 3;
            },
            maxWebhooks: 10,
            createWebhook: async (payload) => {
                calls.push(`create:${payload.channel_id}`);
                createdPayloads.push(payload);
                return { id: "webhook-id", channel_id: payload.channel_id };
            },
        });

        assert.deepEqual(calls, [
            "resolve:user-id:source-guild:source-channel",
            "resolve:user-id:target-guild:target-channel",
            "check:source-channel:VIEW_CHANNEL",
            "check:target-channel:MANAGE_WEBHOOKS",
            "count:target-channel",
            "create:target-channel",
        ]);
        assert.deepEqual(createdPayloads, [createChannelFollowerWebhookPayload(source, target, "user-id")]);
        assert.deepEqual(response, createFollowedChannelResponse("target-channel", "webhook-id"));
    });

    test("rejects following when the user cannot manage webhooks in the target channel before creating a webhook", async () => {
        const { calls, getChannelPermission } = createPermissionResolver({
            [target.id]: ["MANAGE_WEBHOOKS"],
        });

        await assert.rejects(
            () =>
                followAnnouncementChannel({
                    userId: "user-id",
                    sourceChannel: source,
                    targetChannel: target,
                    getChannelPermission,
                    countTargetWebhooks: async () => {
                        calls.push("count");
                        return 0;
                    },
                    maxWebhooks: 10,
                    createWebhook: async (payload) => {
                        calls.push(`create:${payload.channel_id}`);
                        return { id: "webhook-id", channel_id: payload.channel_id };
                    },
                }),
            /target-channel missing MANAGE_WEBHOOKS/,
        );

        assert.deepEqual(
            calls.filter((call) => call.startsWith("check:")),
            ["check:source-channel:VIEW_CHANNEL", "check:target-channel:MANAGE_WEBHOOKS"],
        );
        assert.equal(calls.includes("count"), false);
        assert.equal(
            calls.some((call) => call.startsWith("create:")),
            false,
        );
    });
});
