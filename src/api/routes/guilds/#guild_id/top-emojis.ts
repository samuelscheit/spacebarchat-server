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
import type { GuildTopEmojiResponseItem, GuildTopEmojisResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, Guild, Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import type { FindOneOptions } from "typeorm";

export interface GuildTopEmojisDependencies {
    findGuild(options: FindOneOptions<Guild>): Promise<{ id: string } | null>;
    isGuildMember(userId: string | undefined, guildId: string): Promise<boolean>;
    findTopEmojiItems(guildId: string): Promise<GuildTopEmojiResponseItem[]>;
}

const defaultDependencies: GuildTopEmojisDependencies = {
    findGuild: (options) => Guild.findOne(options) as Promise<{ id: string } | null>,
    isGuildMember: async (userId, guildId) => Boolean(userId && (await Member.exists({ where: { id: userId, guild_id: guildId } }))),
    findTopEmojiItems: async () => [],
};

export function createGuildTopEmojisRouter(dependencies: GuildTopEmojisDependencies = defaultDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Top Emojis",
            description: "Returns source-backed top emoji rankings for the guild when available.",
            responses: {
                200: {
                    body: "GuildTopEmojisResponse",
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
            const { guild_id } = req.params as { [key: string]: string };

            return res.json(await getGuildTopEmojisResponse(guild_id, req.user_id, dependencies));
        },
    );

    return router;
}

export async function getGuildTopEmojisResponse(
    guildId: string,
    userId: string | undefined,
    dependencies: GuildTopEmojisDependencies = defaultDependencies,
): Promise<GuildTopEmojisResponse> {
    const guild = await dependencies.findGuild({
        where: { id: guildId },
        select: { id: true },
    });
    if (!guild) throw unknownGuildError();

    if (!(await dependencies.isGuildMember(userId, guildId))) throw new HTTPError("You are not member of this guild", 403);

    return {
        items: await dependencies.findTopEmojiItems(guildId),
    };
}

function unknownGuildError() {
    return new ApiError(DiscordApiErrors.UNKNOWN_GUILD.message, DiscordApiErrors.UNKNOWN_GUILD.code, 404);
}

export default createGuildTopEmojisRouter();
