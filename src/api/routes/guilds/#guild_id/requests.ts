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
import type { GuildJoinRequestCooldownResponse, GuildJoinRequestsResponse } from "@spacebar/schemas";
import { Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type GuildJoinRequestsGuildRepository = {
    findOneOrFail(options: unknown): Promise<unknown>;
};

export type GuildJoinRequestsRepositories = {
    guildRepository?: GuildJoinRequestsGuildRepository;
};

export type CurrentUserGuildJoinRequestResponse = null;

function getGuildRepository(repository?: GuildJoinRequestsGuildRepository): GuildJoinRequestsGuildRepository {
    return repository ?? (Guild as unknown as GuildJoinRequestsGuildRepository);
}

export function buildGuildJoinRequestsResponse(): GuildJoinRequestsResponse {
    return [];
}

export function buildGuildJoinRequestCooldownResponse(): GuildJoinRequestCooldownResponse {
    return { cooldown: 0 };
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

export async function getCurrentUserGuildJoinRequest(
    guildId: string,
    userId: string,
    repositories: GuildJoinRequestsRepositories = {},
): Promise<CurrentUserGuildJoinRequestResponse> {
    const guildRepository = getGuildRepository(repositories.guildRepository);

    await guildRepository.findOneOrFail({
        where: { id: guildId },
        select: { id: true },
    });

    void userId;
    // Spacebar does not currently persist Discord's current-user guild join request state.
    return null;
}

export async function getCurrentUserGuildJoinRequestCooldown(
    guildId: string,
    userId: string,
    repositories: GuildJoinRequestsRepositories = {},
): Promise<GuildJoinRequestCooldownResponse> {
    const guildRepository = getGuildRepository(repositories.guildRepository);

    await guildRepository.findOneOrFail({
        where: { id: guildId },
        select: { id: true },
    });

    void userId;
    // Spacebar does not currently persist Discord's current-user guild join request cooldown state.
    return buildGuildJoinRequestCooldownResponse();
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

    router.get(
        "/@me",
        route({
            summary: "Get Current User Guild Join Request",
            description:
                "Returns the authenticated user's pending guild join request when persisted state exists; otherwise returns 204 with no body. Spacebar currently has no durable current-user guild join request store.",
            responses: {
                204: {},
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const guildId = req.params.guild_id as string;
            const joinRequest = await getCurrentUserGuildJoinRequest(guildId, req.user_id, repositories);

            if (joinRequest === null) return res.sendStatus(204);

            return res.status(200).json(joinRequest);
        },
    );

    router.get(
        "/@me/cooldown",
        route({
            summary: "Get Guild Join Request Cooldown",
            description:
                "Returns the authenticated user's remaining guild join request cooldown in seconds. Spacebar currently has no durable current-user guild join request cooldown store, so the locally backed conservative response is zero seconds.",
            responses: {
                200: {
                    body: "GuildJoinRequestCooldownResponse",
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
            const guildId = req.params.guild_id as string;

            return res.status(200).json(await getCurrentUserGuildJoinRequestCooldown(guildId, req.user_id, repositories));
        },
    );

    return router;
}

export default createGuildJoinRequestsRouter();
