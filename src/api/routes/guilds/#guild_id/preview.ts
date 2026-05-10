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
import { ApiError, DiscordApiErrors, Guild, GuildFeature, Member, type GuildFeatureValue } from "@spacebar/util";
import type { GuildPreviewResponse, StickerResponse } from "@spacebar/schemas";
import type { EmojiResponse } from "../../../../schemas/api/guilds/Emoji";
import { Request, Response, Router } from "express";
import type { FindOneOptions, FindOptionsWhere } from "typeorm";

type GuildFindOptions = FindOneOptions<Guild>;
type MemberFindOptions = FindOneOptions<Member>;
type MemberCountWhere = FindOptionsWhere<Member>;

interface GuildPreviewEmojiSource {
    id: string;
    animated?: boolean;
    available?: boolean;
    managed?: boolean;
    name: string | null;
    require_colons?: boolean;
    roles?: string[];
}

interface GuildPreviewStickerSource {
    id: string;
    available?: boolean;
    description?: string | null;
    format_type: StickerResponse["format_type"];
    guild_id?: string;
    name: string;
    tags?: string | null;
    type: StickerResponse["type"];
}

export interface GuildPreviewGuildSource {
    id: string;
    name: string;
    icon?: string | null;
    description?: string | null;
    splash?: string | null;
    discovery_splash?: string | null;
    features: GuildFeatureValue[];
    discovery_excluded?: boolean;
    emojis?: GuildPreviewEmojiSource[];
    stickers?: GuildPreviewStickerSource[];
}

export interface GuildPreviewDependencies {
    findGuild(options: GuildFindOptions): Promise<GuildPreviewGuildSource | null>;
    findMember(options: MemberFindOptions): Promise<{ id: string } | null>;
    countMembers(where: MemberCountWhere): Promise<number>;
    countOnlineMembers(where: MemberCountWhere): Promise<number>;
}

const defaultDependencies: GuildPreviewDependencies = {
    findGuild: (options) => Guild.findOne(options) as Promise<GuildPreviewGuildSource | null>,
    findMember: (options) => Member.findOne(options) as Promise<{ id: string } | null>,
    countMembers: (where) => Member.countBy(where),
    countOnlineMembers: (where) => Member.countBy(where),
};

export function createGuildPreviewRouter(dependencies: GuildPreviewDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Preview",
            responses: {
                200: {
                    body: "GuildPreviewResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { guild_id } = req.params as { [key: string]: string };

            return res.json(await getGuildPreviewResponse(guild_id, req.user_id, dependencies));
        },
    );

    return router;
}

export async function getGuildPreviewResponse(guildId: string, userId: string, dependencies: GuildPreviewDependencies = defaultDependencies): Promise<GuildPreviewResponse> {
    const guild = await dependencies.findGuild({
        where: { id: guildId },
        relations: {
            emojis: true,
            stickers: true,
        },
        select: {
            id: true,
            name: true,
            icon: true,
            description: true,
            splash: true,
            discovery_splash: true,
            features: true,
            discovery_excluded: true,
            emojis: {
                id: true,
                animated: true,
                available: true,
                managed: true,
                name: true,
                require_colons: true,
                roles: true,
            },
            stickers: {
                id: true,
                available: true,
                description: true,
                format_type: true,
                guild_id: true,
                name: true,
                tags: true,
                type: true,
            },
        },
    });
    if (!guild) throw unknownGuildPreviewError();

    const member = await dependencies.findMember({
        where: { guild_id: guildId, id: userId },
        select: { id: true },
    });
    if (!member && !isGuildPreviewVisibleToNonMember(guild)) throw unknownGuildPreviewError();

    const [approximateMemberCount, approximatePresenceCount] = await Promise.all([
        dependencies.countMembers({ guild_id: guildId }),
        dependencies.countOnlineMembers({
            guild_id: guildId,
            user: {
                sessions: {
                    status: "online",
                },
            },
        }),
    ]);

    return toGuildPreviewResponse(guild, { approximateMemberCount, approximatePresenceCount });
}

export function toGuildPreviewResponse(guild: GuildPreviewGuildSource, counts: { approximateMemberCount: number; approximatePresenceCount: number }): GuildPreviewResponse {
    return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon ?? null,
        description: guild.description ?? null,
        splash: guild.splash ?? null,
        discovery_splash: guild.discovery_splash ?? null,
        features: guild.features,
        emojis: (guild.emojis ?? []).map(toGuildPreviewEmoji),
        stickers: (guild.stickers ?? []).map(toGuildPreviewSticker),
        approximate_member_count: counts.approximateMemberCount,
        approximate_presence_count: counts.approximatePresenceCount,
    };
}

export function isGuildPreviewVisibleToNonMember(guild: Pick<GuildPreviewGuildSource, "features" | "discovery_excluded">) {
    return guild.features.includes(GuildFeature.Discoverable) && guild.discovery_excluded !== true;
}

export function unknownGuildPreviewError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_GUILD.message, DiscordApiErrors.UNKNOWN_GUILD.code, 404);
}

function toGuildPreviewEmoji(emoji: GuildPreviewEmojiSource): EmojiResponse {
    return omitUndefined({
        id: emoji.id,
        name: emoji.name,
        roles: emoji.roles ?? [],
        require_colons: emoji.require_colons,
        managed: emoji.managed,
        animated: emoji.animated,
        available: emoji.available,
    } satisfies EmojiResponse);
}

function toGuildPreviewSticker(sticker: GuildPreviewStickerSource): StickerResponse {
    return omitUndefined({
        id: sticker.id,
        name: sticker.name,
        description: sticker.description ?? null,
        tags: sticker.tags ?? "",
        type: sticker.type,
        format_type: sticker.format_type,
        available: sticker.available,
        guild_id: sticker.guild_id,
    } satisfies StickerResponse);
}

function omitUndefined<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export default createGuildPreviewRouter();
