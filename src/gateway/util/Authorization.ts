import { Channel, getPermission, type PermissionResolvable, type Permissions } from "@spacebar/util";
import { ChannelType } from "@spacebar/schemas";

export interface GatewayChannelAccess {
    channel: Channel;
    permissions: Permissions;
}

export interface GatewayChannelAccessOptions {
    userId: string;
    guildId?: string | null;
    channelId?: string | null;
    permission: PermissionResolvable;
}

function normalizeGuildId(guildId?: string | null) {
    return guildId ?? undefined;
}

/**
 * Shared fail-closed authorization for gateway opcodes that operate on a caller-supplied channel id.
 *
 * Gateway payloads are untrusted.  This helper mirrors REST permission enforcement by resolving the
 * real channel/guild relationship, requiring membership through getPermission, applying channel
 * overwrites, and rejecting mismatched guild_id/channel_id pairs before an opcode creates state or
 * issues voice/stream tokens.
 */
export async function assertGatewayChannelAccess({ userId, guildId, channelId, permission }: GatewayChannelAccessOptions): Promise<GatewayChannelAccess> {
    if (!channelId) throw new Error("channel_id is required");

    const expectedGuildId = normalizeGuildId(guildId);
    const permissions = await getPermission(userId, expectedGuildId, channelId);
    permissions.hasThrow(permission);

    const channel = permissions.cache.channel ?? (await Channel.findOneOrFail({ where: { id: channelId } }));
    const actualGuildId = normalizeGuildId(channel.guild_id);

    if (expectedGuildId !== undefined && actualGuildId !== expectedGuildId) {
        throw new Error("channel_id does not belong to guild_id");
    }

    return { channel, permissions };
}

export function assertGuildStreamKeyMatchesChannel(guildId: string | undefined, channel: Channel) {
    if (!guildId || normalizeGuildId(channel.guild_id) !== guildId) {
        throw new Error("stream key does not match channel guild");
    }
}

export function assertCallStreamKeyMatchesChannel(channel: Channel) {
    if (normalizeGuildId(channel.guild_id) !== undefined) {
        throw new Error("call stream key cannot target a guild channel");
    }
}

export function assertGatewayVoiceChannel(channel: Channel) {
    if (![ChannelType.GUILD_VOICE, ChannelType.GUILD_STAGE_VOICE, ChannelType.DM, ChannelType.GROUP_DM].includes(channel.type)) {
        throw new Error("channel is not voice capable");
    }
}
