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
import { ApiError, Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type CreatorMonetizationMarketingOnboardingGuildRepository = {
    findOneOrFail(options: unknown): Promise<unknown>;
};

export type CreatorMonetizationMarketingOnboardingRepositories = {
    guildRepository?: CreatorMonetizationMarketingOnboardingGuildRepository;
};

export const CREATOR_MONETIZATION_MARKETING_ONBOARDING_UNSUPPORTED_MESSAGE = "Creator monetization marketing onboarding is not supported on this Spacebar instance.";

function getGuildRepository(repository?: CreatorMonetizationMarketingOnboardingGuildRepository): CreatorMonetizationMarketingOnboardingGuildRepository {
    return repository ?? (Guild as unknown as CreatorMonetizationMarketingOnboardingGuildRepository);
}

export function createCreatorMonetizationMarketingOnboardingUnsupportedError(): ApiError {
    return new ApiError(CREATOR_MONETIZATION_MARKETING_ONBOARDING_UNSUPPORTED_MESSAGE, 0, 501);
}

export async function getCreatorMonetizationMarketingOnboarding(guildId: string, repositories: CreatorMonetizationMarketingOnboardingRepositories = {}): Promise<never> {
    const guildRepository = getGuildRepository(repositories.guildRepository);
    await guildRepository.findOneOrFail({
        where: { id: guildId },
        select: { id: true },
    });

    // Discord's creator monetization marketing onboarding depends on
    // provider-backed monetization state and marketing onboarding progress.
    // Spacebar does not persist that state, so fail closed after guild access checks.
    throw createCreatorMonetizationMarketingOnboardingUnsupportedError();
}

export function createCreatorMonetizationMarketingOnboardingRouter(repositories: CreatorMonetizationMarketingOnboardingRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Creator Monetization Marketing Onboarding",
            description:
                "Returns creator monetization marketing onboarding state for a guild. This Discord endpoint depends on provider-backed creator monetization state and marketing onboarding progress; Spacebar does not currently persist that state, so this compatibility endpoint fails closed after MANAGE_GUILD access checks.",
            permission: "MANAGE_GUILD",
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
            await getCreatorMonetizationMarketingOnboarding(req.params.guild_id as string, repositories);
        },
    );

    return router;
}

export default createCreatorMonetizationMarketingOnboardingRouter();
