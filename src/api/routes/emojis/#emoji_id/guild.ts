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
import { DiscordApiErrors, Emoji, Guild, GuildFeature, Invite, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { type APIErrorResponse, type EmojiGuildResponse } from "@spacebar/schemas";
import { type EmojiResponse } from "../../../../schemas/api/guilds/Emoji";

const MAX_EMOJI_GUILD_EMOJIS = 30;

interface EmojiGuildEmojiRecord {
    id: string;
    animated: boolean;
    available: boolean;
    managed: boolean;
    name: string | null;
    require_colons: boolean;
    roles: string[];
}

export interface EmojiGuildRecord {
    id: string;
    name: string;
    icon?: string | null;
    banner?: string | null;
    splash?: string | null;
    discovery_splash?: string | null;
    description?: string | null;
    features: string[];
    preferred_locale?: string | null;
    premium_subscription_count?: number | null;
    discovery_excluded?: boolean;
    primary_category_id?: number | null;
    emojis?: EmojiGuildEmojiRecord[];
}

export interface EmojiGuildVanityInviteRecord {
    code: string;
    isExpired(now?: Date): boolean;
}

export interface EmojiGuildDependencies {
    findEmojiGuildId(emojiId: string): Promise<string | null>;
    findGuild(guildId: string): Promise<EmojiGuildRecord | null>;
    findVanityInvites(guildId: string): Promise<EmojiGuildVanityInviteRecord[]>;
    countMembers(guildId: string): Promise<number>;
    countOnlineMembers(guildId: string): Promise<number>;
}

const defaultDependencies: EmojiGuildDependencies = {
    async findEmojiGuildId(emojiId: string) {
        const emoji = await Emoji.findOne({
            where: { id: emojiId },
            select: { guild_id: true },
        });

        return emoji?.guild_id ?? null;
    },
    async findGuild(guildId: string) {
        return (await Guild.findOne({
            where: { id: guildId },
            relations: {
                emojis: true,
            },
            select: {
                id: true,
                name: true,
                icon: true,
                banner: true,
                splash: true,
                discovery_splash: true,
                description: true,
                features: true,
                preferred_locale: true,
                premium_subscription_count: true,
                discovery_excluded: true,
                primary_category_id: true,
                emojis: {
                    id: true,
                    animated: true,
                    available: true,
                    managed: true,
                    name: true,
                    require_colons: true,
                    roles: true,
                },
            },
        })) as EmojiGuildRecord | null;
    },
    async findVanityInvites(guildId: string) {
        return (await Invite.find({
            where: { guild_id: guildId, vanity_url: true },
            select: {
                code: true,
                uses: true,
                max_age: true,
                max_uses: true,
                expires_at: true,
            },
        })) as EmojiGuildVanityInviteRecord[];
    },
    countMembers(guildId: string) {
        return Member.countBy({
            guild_id: guildId,
        });
    },
    countOnlineMembers(guildId: string) {
        return Member.countBy({
            guild_id: guildId,
            user: {
                sessions: {
                    status: "online",
                },
            },
        });
    },
};

function omitUndefined<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function toEmojiResponse(emoji: EmojiGuildEmojiRecord): EmojiResponse {
    return {
        id: emoji.id,
        animated: emoji.animated,
        available: emoji.available,
        managed: emoji.managed,
        name: emoji.name,
        require_colons: emoji.require_colons,
        roles: emoji.roles,
    };
}

export function canExposeEmojiGuild(guild: EmojiGuildRecord): boolean {
    return guild.features.includes(GuildFeature.Discoverable) && guild.discovery_excluded !== true;
}

export function buildEmojiGuildResponse(
    guild: EmojiGuildRecord,
    counts: { approximateMemberCount: number; approximatePresenceCount: number },
    vanityInvite: EmojiGuildVanityInviteRecord | undefined,
): EmojiGuildResponse {
    const emojis = guild.emojis?.map(toEmojiResponse) ?? [];

    return omitUndefined({
        id: guild.id,
        name: guild.name,
        icon: guild.icon ?? null,
        banner: guild.banner ?? null,
        splash: guild.splash ?? null,
        discovery_splash: guild.discovery_splash ?? null,
        description: guild.description ?? null,
        features: guild.features,
        vanity_url_code: vanityInvite?.code ?? null,
        preferred_locale: guild.preferred_locale ?? undefined,
        premium_subscription_count: guild.premium_subscription_count ?? null,
        approximate_member_count: counts.approximateMemberCount,
        approximate_presence_count: counts.approximatePresenceCount,
        emojis: emojis.slice(0, MAX_EMOJI_GUILD_EMOJIS),
        emoji_count: emojis.length,
        auto_removed: guild.discovery_excluded === true,
        primary_category_id: guild.primary_category_id ?? null,
        is_published: guild.features.includes(GuildFeature.Discoverable),
    } satisfies EmojiGuildResponse);
}

export async function getEmojiGuild(emojiId: string, dependencies: EmojiGuildDependencies = defaultDependencies): Promise<EmojiGuildResponse | null> {
    const guildId = await dependencies.findEmojiGuildId(emojiId);
    if (!guildId) return null;

    const guild = await dependencies.findGuild(guildId);
    if (!guild || !canExposeEmojiGuild(guild)) return null;

    const [approximateMemberCount, approximatePresenceCount, vanityInvites] = await Promise.all([
        dependencies.countMembers(guild.id),
        dependencies.countOnlineMembers(guild.id),
        dependencies.findVanityInvites(guild.id),
    ]);

    return buildEmojiGuildResponse(
        guild,
        {
            approximateMemberCount,
            approximatePresenceCount,
        },
        vanityInvites.find((invite) => !invite.isExpired()),
    );
}

function sendUnknownEmoji(res: Response) {
    return res.status(404).json({
        code: DiscordApiErrors.UNKNOWN_EMOJI.code,
        message: DiscordApiErrors.UNKNOWN_EMOJI.message,
    } satisfies APIErrorResponse);
}

export function createEmojiGuildRouter(dependencies: EmojiGuildDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Emoji Guild",
            responses: {
                200: {
                    body: "EmojiGuildResponse",
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
            const emojiGuild = await getEmojiGuild(req.params.emoji_id as string, dependencies);
            if (!emojiGuild) return sendUnknownEmoji(res);

            return res.status(200).json(emojiGuild);
        },
    );

    return router;
}

export default createEmojiGuildRouter();
