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
import type { GuildOnboardingResponse } from "@spacebar/schemas";
import { Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type GuildOnboardingGuildRepository = {
    findOneOrFail(options: unknown): Promise<unknown>;
};

export type GuildOnboardingRepositories = {
    guildRepository?: GuildOnboardingGuildRepository;
};

function getGuildRepository(repository?: GuildOnboardingGuildRepository): GuildOnboardingGuildRepository {
    return repository ?? (Guild as unknown as GuildOnboardingGuildRepository);
}

export function buildDefaultGuildOnboardingResponse(guildId: string): GuildOnboardingResponse {
    return {
        guild_id: guildId,
        prompts: [],
        default_channel_ids: [],
        enabled: false,
        below_requirements: true,
        mode: 0,
    };
}

export async function getGuildOnboarding(guildId: string, repositories: GuildOnboardingRepositories = {}): Promise<GuildOnboardingResponse> {
    const guildRepository = getGuildRepository(repositories.guildRepository);

    await guildRepository.findOneOrFail({
        where: { id: guildId },
        select: { id: true },
    });

    // Spacebar does not persist Discord's onboarding prompts or default channel
    // opt-ins yet, so expose only a locally truthful disabled configuration.
    return buildDefaultGuildOnboardingResponse(guildId);
}

export function createGuildOnboardingRouter(repositories: GuildOnboardingRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Onboarding",
            description:
                "Returns the guild onboarding configuration. Spacebar does not currently persist Discord's onboarding prompts, default channel opt-ins, or enabled state, so this compatibility endpoint returns a disabled onboarding object with empty prompts and default channels. Discord requires MANAGE_GUILD when onboarding is disabled.",
            permission: "MANAGE_GUILD",
            responses: {
                200: {
                    body: "GuildOnboardingResponse",
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

            return res.status(200).json(await getGuildOnboarding(guildId, repositories));
        },
    );

    return router;
}

export default createGuildOnboardingRouter();
