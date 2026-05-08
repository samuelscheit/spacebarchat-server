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

import type { Channel, PermissionResolvable, Permissions } from "@spacebar/util";
import { HTTPError } from "lambert-server";
import { In } from "typeorm";

export type ChannelVisibilityTarget = Pick<Channel, "id"> & Partial<Pick<Channel, "guild_id">>;

export type ChannelPermissionResolver = (userId: string | undefined, guildId: string | undefined, channel: ChannelVisibilityTarget) => Promise<Pick<Permissions, "has">>;

export type ChannelLookup = (channelIds: string[]) => Promise<ChannelVisibilityTarget[]>;
export type GuildMemberLookup = (userId: string, guildId: string) => Promise<boolean>;
export type ChannelIdSetOptions = {
    requiredPermissions?: PermissionResolvable[];
    findChannelsById?: ChannelLookup;
    resolvePermission?: ChannelPermissionResolver;
};
export type ViewableChannelIdSetOptions = Omit<ChannelIdSetOptions, "requiredPermissions">;

const defaultPermissionResolver: ChannelPermissionResolver = async (userId, guildId, channel) => {
    const { getPermission } = await import("../../../util/index.js");
    return getPermission(userId, guildId, channel.id);
};

const defaultChannelLookup: ChannelLookup = async (channelIds) => {
    const { Channel } = await import("../../../util/index.js");
    return Channel.find({
        where: { id: In(channelIds) },
        relations: { recipients: true },
    });
};

const defaultGuildMemberLookup: GuildMemberLookup = async (userId, guildId) => {
    const { Member } = await import("../../../util/index.js");
    return Member.exists({
        where: { id: userId, guild_id: guildId },
    });
};

export async function assertGuildMember(userId: string | undefined, guildId: string, memberLookup: GuildMemberLookup = defaultGuildMemberLookup) {
    if (!userId || !(await memberLookup(userId, guildId))) throw new HTTPError("You are not member of this guild", 403);
}

function isExpectedPermissionMiss(error: unknown) {
    if (error instanceof HTTPError) return true;
    return error instanceof Error && error.name === "EntityNotFoundError";
}

export async function hasChannelPermissions(
    userId: string | undefined,
    channel: ChannelVisibilityTarget,
    requiredPermissions: PermissionResolvable[],
    resolvePermission: ChannelPermissionResolver = defaultPermissionResolver,
) {
    if (!userId) return false;

    try {
        const permissions = await resolvePermission(userId, channel.guild_id, channel);
        return requiredPermissions.every((permission) => permissions.has(permission));
    } catch (error) {
        if (isExpectedPermissionMiss(error)) return false;
        throw error;
    }
}

export async function canViewChannel(userId: string | undefined, channel: ChannelVisibilityTarget, resolvePermission: ChannelPermissionResolver = defaultPermissionResolver) {
    return hasChannelPermissions(userId, channel, ["VIEW_CHANNEL"], resolvePermission);
}

export async function filterViewableChannels<T extends ChannelVisibilityTarget>(
    userId: string | undefined,
    channels: T[],
    resolvePermission: ChannelPermissionResolver = defaultPermissionResolver,
) {
    const visible: T[] = [];

    for (const channel of channels) {
        if (await canViewChannel(userId, channel, resolvePermission)) visible.push(channel);
    }

    return visible;
}

export async function getChannelIdSetWithPermissions(
    userId: string | undefined,
    channelIds: string[],
    { requiredPermissions = ["VIEW_CHANNEL"], findChannelsById = defaultChannelLookup, resolvePermission = defaultPermissionResolver }: ChannelIdSetOptions = {},
) {
    if (channelIds.length === 0) return new Set<string>();

    const uniqueChannelIds = [...new Set(channelIds)];
    const channels = await findChannelsById(uniqueChannelIds);
    const visibleChannels: ChannelVisibilityTarget[] = [];

    for (const channel of channels) {
        if (await hasChannelPermissions(userId, channel, requiredPermissions, resolvePermission)) visibleChannels.push(channel);
    }

    return new Set(visibleChannels.map((channel) => channel.id));
}

export async function getViewableChannelIdSet(userId: string | undefined, channelIds: string[], options: ViewableChannelIdSetOptions = {}) {
    return getChannelIdSetWithPermissions(userId, channelIds, { ...options, requiredPermissions: ["VIEW_CHANNEL"] });
}
