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
import type { GuildJoinRequestsResponse } from "@spacebar/schemas";
import { Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type GuildJoinRequestsGuildRepository = {
    findOneOrFail(options: unknown): Promise<unknown>;
};

export type GuildJoinRequestsRepositories = {
    guildRepository?: GuildJoinRequestsGuildRepository;
};

function getGuildRepository(repository?: GuildJoinRequestsGuildRepository): GuildJoinRequestsGuildRepository {
    return repository ?? (Guild as unknown as GuildJoinRequestsGuildRepository);
}

export function buildGuildJoinRequestsResponse(): GuildJoinRequestsResponse {
    return [];
}

export async function getGuildJoinRequests(guildId: string, repositories: GuildJoinRequestsRepositories = {}): Promise<GuildJoinRequestsResponse> {
    const guildRepository = getGuildRepository(repositories.guildRepository);

    await guildRepository.findOneOrFail({
        where: { id: guildId },
        select: { id: true },
    });

    // Spacebar does not currently persist Discord's guild join request queue.
    // Return only locally truthful pending requests.
    return buildGuildJoinRequestsResponse();
}

export function createGuildJoinRequestsRouter(repositories: GuildJoinRequestsRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Join Requests",
            description:
                "Returns pending guild join requests for the guild. Spacebar does not currently persist Discord's guild join request queue, so the locally backed conservative response is an empty array.",
            permission: "MANAGE_GUILD",
            responses: {
                200: {
                    body: "GuildJoinRequestsResponse",
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
            const guildId = req.params.guild_id as string;

            return res.status(200).json(await getGuildJoinRequests(guildId, repositories));
        },
    );

    return router;
}

export default createGuildJoinRequestsRouter();
