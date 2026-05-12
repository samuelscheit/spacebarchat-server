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

import { route } from "@spacebar/api";
import { Channel, DiscordApiErrors, FieldErrors, Guild, Member, Permissions, Role, User, ApiError, getGuildChannelOrdering } from "@spacebar/util";
import { ChannelType, type OAuthAuthorizeWebhookChannel, type OAuthAuthorizeWebhookChannelsResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

const MISSING_ACCESS = new ApiError(DiscordApiErrors.MISSING_ACCESS.message, DiscordApiErrors.MISSING_ACCESS.code, 403);

export type OAuthAuthorizeWebhookChannelSource = Pick<Channel, "id" | "name" | "type" | "guild_id" | "permission_overwrites">;
export type OAuthAuthorizeWebhookGuildSource = Pick<Guild, "id" | "owner_id" | "channel_ordering">;
export type OAuthAuthorizeWebhookMemberSource = Pick<Member, "id" | "communication_disabled_until"> & {
    roles?: Pick<Role, "id" | "permissions">[];
    user?: Pick<User, "flags">;
};

export type OAuthAuthorizeWebhookChannelsDependencies = {
    findGuild?: (guildId: string) => Promise<OAuthAuthorizeWebhookGuildSource | null>;
    findMember?: (guildId: string, userId: string) => Promise<OAuthAuthorizeWebhookMemberSource | null>;
    findChannels?: (guildId: string) => Promise<OAuthAuthorizeWebhookChannelSource[]>;
};

const defaultDependencies = {
    async findGuild(guildId: string) {
        return Guild.findOne({
            where: { id: guildId },
            select: { id: true, owner_id: true, channel_ordering: true },
        }) as Promise<OAuthAuthorizeWebhookGuildSource | null>;
    },
    async findMember(guildId: string, userId: string) {
        return Member.findOne({
            where: { id: userId, guild_id: guildId },
            relations: { roles: true, user: true },
            select: {
                id: true,
                communication_disabled_until: true,
                roles: {
                    id: true,
                    permissions: true,
                },
                user: {
                    flags: true,
                },
            },
        }) as Promise<OAuthAuthorizeWebhookMemberSource | null>;
    },
    async findChannels(guildId: string) {
        return Channel.find({
            where: { guild_id: guildId },
            select: {
                id: true,
                name: true,
                type: true,
                guild_id: true,
                permission_overwrites: true,
            },
        }) as Promise<OAuthAuthorizeWebhookChannelSource[]>;
    },
} satisfies Required<OAuthAuthorizeWebhookChannelsDependencies>;

export function isOAuthAuthorizeWebhookChannelType(type: number): type is ChannelType.GUILD_TEXT | ChannelType.GUILD_NEWS {
    return type === ChannelType.GUILD_TEXT || type === ChannelType.GUILD_NEWS;
}

export function canInstallOAuthWebhookInChannel(
    userId: string,
    guild: OAuthAuthorizeWebhookGuildSource,
    member: OAuthAuthorizeWebhookMemberSource,
    channel: OAuthAuthorizeWebhookChannelSource,
) {
    if (channel.guild_id !== guild.id || !isOAuthAuthorizeWebhookChannelType(channel.type) || !channel.name) return false;

    const roles = member.roles ?? [];
    const permissions = Permissions.finalPermission({
        user: {
            id: userId,
            roles: roles.map((role) => role.id),
            resolved_roles: roles as Role[],
            communication_disabled_until: member.communication_disabled_until ?? null,
            flags: member.user?.flags ?? 0,
        },
        guild: {
            id: guild.id,
            owner_id: guild.owner_id ?? "",
        },
        channel: {
            overwrites: channel.permission_overwrites,
        },
    });

    return permissions.has("VIEW_CHANNEL") && permissions.has("MANAGE_WEBHOOKS");
}

export function toOAuthAuthorizeWebhookChannel(channel: OAuthAuthorizeWebhookChannelSource): OAuthAuthorizeWebhookChannel {
    if (!isOAuthAuthorizeWebhookChannelType(channel.type) || !channel.guild_id || !channel.name) {
        throw new Error("Cannot serialize a channel that is not webhook-installable");
    }

    return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        guild_id: channel.guild_id,
    };
}

function compareChannelsByGuildOrdering(guild: OAuthAuthorizeWebhookGuildSource) {
    const ordering = getGuildChannelOrdering(guild);
    return (a: OAuthAuthorizeWebhookChannelSource, b: OAuthAuthorizeWebhookChannelSource) => {
        const aIndex = ordering.indexOf(a.id);
        const bIndex = ordering.indexOf(b.id);
        if (aIndex !== -1 || bIndex !== -1) {
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            if (aIndex !== bIndex) return aIndex - bIndex;
        }

        return (a.name ?? "").localeCompare(b.name ?? "") || a.id.localeCompare(b.id);
    };
}

export async function getOAuthAuthorizeWebhookChannels(
    userId: string,
    guildId: string,
    dependencies: OAuthAuthorizeWebhookChannelsDependencies = {},
): Promise<OAuthAuthorizeWebhookChannelsResponse> {
    const deps = { ...defaultDependencies, ...dependencies };
    const [guild, member, channels] = await Promise.all([deps.findGuild(guildId), deps.findMember(guildId, userId), deps.findChannels(guildId)]);

    if (!guild) throw DiscordApiErrors.UNKNOWN_GUILD;
    if (!member) throw MISSING_ACCESS;

    return channels
        .filter((channel) => canInstallOAuthWebhookInChannel(userId, guild, member, channel))
        .sort(compareChannelsByGuildOrdering(guild))
        .map(toOAuthAuthorizeWebhookChannel);
}

function getRequiredGuildId(req: Request) {
    const guildId = req.query.guild_id;
    if (typeof guildId === "string" && guildId) return guildId;

    throw FieldErrors({
        guild_id: {
            code: "BASE_TYPE_REQUIRED",
            message: req.t("common:field.BASE_TYPE_REQUIRED"),
        },
    });
}

export function createOAuthAuthorizeWebhookChannelsRouter(dependencies: OAuthAuthorizeWebhookChannelsDependencies = {}) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get OAuth2 Authorize Webhook Channels",
            description: "Returns text channels in the selected guild where the current user can install an incoming OAuth2 webhook.",
            query: {
                guild_id: {
                    type: "string",
                    required: true,
                    description: "Guild to inspect for webhook-installable channels.",
                },
            },
            responses: {
                200: {
                    body: "OAuthAuthorizeWebhookChannelsResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const channels = await getOAuthAuthorizeWebhookChannels(req.user_id, getRequiredGuildId(req), dependencies);

            return res.json(channels);
        },
    );

    return router;
}

export default createOAuthAuthorizeWebhookChannelsRouter();
