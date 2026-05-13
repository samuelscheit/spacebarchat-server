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
import { ApiError, DiscordApiErrors, Guild, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import type { FindOneOptions } from "typeorm";

export const GUILD_LEADERBOARD_UNSUPPORTED_MESSAGE = "Guild leaderboards are not supported on this Spacebar instance.";

export interface GuildLeaderboardDependencies {
    findGuild(options: FindOneOptions<Guild>): Promise<{ id: string } | null>;
    isGuildMember(userId: string | undefined, guildId: string): Promise<boolean>;
}

const defaultDependencies: GuildLeaderboardDependencies = {
    findGuild: (options) => Guild.findOne(options) as Promise<{ id: string } | null>,
    isGuildMember: async (userId, guildId) => Boolean(userId && (await Member.exists({ where: { id: userId, guild_id: guildId } }))),
};

export function createGuildLeaderboardUnsupportedError(): ApiError {
    return new ApiError(GUILD_LEADERBOARD_UNSUPPORTED_MESSAGE, 0, 501);
}

export async function getGuildLeaderboard(
    guildId: string,
    leaderboardId: string,
    userId: string | undefined,
    dependencies: GuildLeaderboardDependencies = defaultDependencies,
): Promise<never> {
    void leaderboardId;

    const guild = await dependencies.findGuild({
        where: { id: guildId },
        select: { id: true },
    });
    if (!guild) throw unknownGuildError();

    if (!(await dependencies.isGuildMember(userId, guildId))) throw new HTTPError("You are not member of this guild", 403);

    // Discord's guild leaderboard route is currently only visible in xHyroM's
    // client route catalog and League of Legends leaderboard experiment data.
    // Spacebar has no durable linked-game ranking provider or documented
    // response contract for this route, so fail closed after access checks.
    throw createGuildLeaderboardUnsupportedError();
}

export function createGuildLeaderboardRouter(dependencies: GuildLeaderboardDependencies = defaultDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Leaderboard",
            description:
                "Returns provider-backed guild leaderboard data for a game leaderboard. Spacebar does not currently persist linked-game leaderboard submissions or rankings, and no public response contract is available for this xHyroM-only route, so this compatibility endpoint fails closed after guild membership checks.",
            responses: {
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, _res: Response) => {
            const { guild_id, param } = req.params as { [key: string]: string };

            await getGuildLeaderboard(guild_id, param, req.user_id, dependencies);
        },
    );

    return router;
}

function unknownGuildError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_GUILD.message, DiscordApiErrors.UNKNOWN_GUILD.code, 404);
}

export default createGuildLeaderboardRouter();
