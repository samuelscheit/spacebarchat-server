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
import type { GuildTopReadChannelsResponse, Snowflake } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, Guild, GuildFeature, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import type { FindOneOptions } from "typeorm";

export type GuildTopReadChannelsGuild = Pick<Guild, "id" | "features" | "discovery_excluded">;

export interface GuildTopReadChannelsDependencies {
    findGuild(options: FindOneOptions<Guild>): Promise<GuildTopReadChannelsGuild | null>;
    isGuildMember(userId: string | undefined, guildId: string): Promise<boolean>;
    findTopReadChannelIds(guildId: string, userId: string | undefined): Promise<Snowflake[]>;
}

const defaultDependencies: GuildTopReadChannelsDependencies = {
    findGuild: (options) => Guild.findOne(options) as Promise<GuildTopReadChannelsGuild | null>,
    isGuildMember: async (userId, guildId) => Boolean(userId && (await Member.exists({ where: { id: userId, guild_id: guildId } }))),
    findTopReadChannelIds: async () => [],
};

export function createGuildTopReadChannelsRouter(dependencies: GuildTopReadChannelsDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Top Read Channels",
            description: "Returns source-backed top read channel IDs for the guild when available.",
            responses: {
                200: {
                    body: "GuildTopReadChannelsResponse",
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

            return res.json(await getGuildTopReadChannelsResponse(guild_id, req.user_id, dependencies));
        },
    );

    return router;
}

export async function getGuildTopReadChannelsResponse(
    guildId: string,
    userId: string | undefined,
    dependencies: GuildTopReadChannelsDependencies = defaultDependencies,
): Promise<GuildTopReadChannelsResponse> {
    const guild = await dependencies.findGuild({
        where: { id: guildId },
        select: { id: true, features: true, discovery_excluded: true },
    });
    if (!guild) throw unknownGuildError();

    const isMember = await dependencies.isGuildMember(userId, guildId);
    if (!isMember && !isGuildVisibleToNonMember(guild)) throw unknownGuildError();

    return (await dependencies.findTopReadChannelIds(guildId, userId)).slice(0, 10);
}

export function isGuildVisibleToNonMember(guild: Pick<GuildTopReadChannelsGuild, "features" | "discovery_excluded">) {
    return guild.features.includes(GuildFeature.Discoverable) && !guild.discovery_excluded;
}

function unknownGuildError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_GUILD.message, DiscordApiErrors.UNKNOWN_GUILD.code, 404);
}

export default createGuildTopReadChannelsRouter();
