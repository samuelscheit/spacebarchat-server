import { HTTPError } from "lambert-server";
import { WebhookType } from "../../../schemas/api/channels/Webhook";
import type { ChannelFollowerStatsResponse } from "../../../schemas/responses/ChannelFollowerStatsResponse";

export enum ChannelFollowerChannelType {
    GuildText = 0,
    GuildVoice = 2,
    GuildNews = 5,
}

export type ChannelFollowerChannel = {
    id: string;
    guild_id?: string | null;
    name?: string | null;
    type: number;
};

export type ChannelFollowerWebhook = {
    type: WebhookType.ChannelFollower;
    name: string;
    guild_id: string;
    channel_id: string;
    user_id: string;
    source_guild_id: string;
    source_channel_id: string;
};

export type ChannelFollowerPermission = {
    hasThrow(permission: "VIEW_CHANNEL" | "MANAGE_WEBHOOKS"): unknown;
};

export type ChannelFollowerPermissionResolver = (userId: string, guildId: string | undefined, channel: ChannelFollowerChannel) => Promise<ChannelFollowerPermission>;

export type CreatedChannelFollowerWebhook = {
    id: string;
    channel_id: string;
};

export type FollowAnnouncementChannelOptions = {
    userId: string;
    sourceChannel: ChannelFollowerChannel;
    targetChannel: ChannelFollowerChannel;
    getChannelPermission: ChannelFollowerPermissionResolver;
    countTargetWebhooks: (channelId: string) => Promise<number>;
    maxWebhooks?: number;
    createWebhook: (payload: ChannelFollowerWebhook) => Promise<CreatedChannelFollowerWebhook>;
};

export type ChannelFollowerStatsWebhook = {
    channel_id?: string | null;
    guild_id?: string | null;
};

export function validateChannelFollowerChannels(source: ChannelFollowerChannel, target: ChannelFollowerChannel) {
    if (source.type !== ChannelFollowerChannelType.GuildNews || !source.guild_id) {
        throw new HTTPError("Cannot execute action on this channel type", 400);
    }

    if ((target.type !== ChannelFollowerChannelType.GuildText && target.type !== ChannelFollowerChannelType.GuildNews) || !target.guild_id) {
        throw new HTTPError("Cannot execute action on this channel type", 400);
    }
}

export function assertChannelSupportsFollowerStats(channel: ChannelFollowerChannel) {
    if (channel.type !== ChannelFollowerChannelType.GuildNews || !channel.guild_id) {
        throw new HTTPError("Cannot execute action on this channel type", 400);
    }
}

export function assertChannelFollowerWebhookLimit(existingWebhookCount: number, maxWebhooks?: number) {
    if (maxWebhooks && existingWebhookCount >= maxWebhooks) {
        throw new HTTPError(`Maximum number of webhooks reached (${maxWebhooks})`, 400);
    }
}

export async function assertChannelFollowerPermissions(
    userId: string,
    source: ChannelFollowerChannel,
    target: ChannelFollowerChannel,
    getChannelPermission: ChannelFollowerPermissionResolver,
) {
    const [sourcePermission, targetPermission] = await Promise.all([
        getChannelPermission(userId, source.guild_id ?? undefined, source),
        getChannelPermission(userId, target.guild_id ?? undefined, target),
    ]);

    sourcePermission.hasThrow("VIEW_CHANNEL");
    targetPermission.hasThrow("MANAGE_WEBHOOKS");
}

export function createChannelFollowerWebhookPayload(source: ChannelFollowerChannel, target: ChannelFollowerChannel, userId: string): ChannelFollowerWebhook {
    validateChannelFollowerChannels(source, target);

    return {
        type: WebhookType.ChannelFollower,
        name: source.name || "Channel Follower",
        guild_id: target.guild_id!,
        channel_id: target.id,
        user_id: userId,
        source_guild_id: source.guild_id!,
        source_channel_id: source.id,
    };
}

export function createFollowedChannelResponse(channelId: string, webhookId: string) {
    return {
        channel_id: channelId,
        webhook_id: webhookId,
    };
}

function countUniqueDefined(values: Iterable<string | null | undefined>) {
    const ids = new Set<string>();
    for (const value of values) {
        if (value) ids.add(value);
    }

    return ids.size;
}

export function getChannelFollowerStatsGuildIds(webhooks: ChannelFollowerStatsWebhook[]) {
    return [...new Set(webhooks.map((webhook) => webhook.guild_id).filter((guildId): guildId is string => Boolean(guildId)))];
}

export function createChannelFollowerStatsResponse(webhooks: ChannelFollowerStatsWebhook[], guildMembers: number): ChannelFollowerStatsResponse {
    return {
        channels_following: countUniqueDefined(webhooks.map((webhook) => webhook.channel_id)),
        guild_members: guildMembers,
        guilds_following: countUniqueDefined(webhooks.map((webhook) => webhook.guild_id)),
        users_seen_ever: 0,
        subscribers_gained_since_last_post: 0,
        subscribers_lost_since_last_post: 0,
    };
}

export async function followAnnouncementChannel({
    userId,
    sourceChannel,
    targetChannel,
    getChannelPermission,
    countTargetWebhooks,
    maxWebhooks,
    createWebhook,
}: FollowAnnouncementChannelOptions) {
    validateChannelFollowerChannels(sourceChannel, targetChannel);
    await assertChannelFollowerPermissions(userId, sourceChannel, targetChannel, getChannelPermission);

    const webhookCount = await countTargetWebhooks(targetChannel.id);
    assertChannelFollowerWebhookLimit(webhookCount, maxWebhooks);

    const hook = await createWebhook(createChannelFollowerWebhookPayload(sourceChannel, targetChannel, userId));

    return createFollowedChannelResponse(hook.channel_id, hook.id);
}
