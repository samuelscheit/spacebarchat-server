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
import { ApiError, Team } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type TeamPayoutOnboardingTarget = {
    owner_user_id?: string | null;
};

export type TeamPayoutOnboardingRepository = {
    findOne(options: unknown): Promise<TeamPayoutOnboardingTarget | null>;
};

export type TeamPayoutOnboardingRepositories = {
    teamRepository?: TeamPayoutOnboardingRepository;
};

export const UNKNOWN_TEAM_PAYOUT_ONBOARDING_TEAM_ERROR = new ApiError("Unknown Team", 10039, 404);
export const MISSING_TEAM_PAYOUT_ONBOARDING_ACCESS_ERROR = new ApiError("Missing Access", 50001, 403);
export const TEAM_PAYOUT_ONBOARDING_UNSUPPORTED_MESSAGE = "Team payout onboarding is not supported on this Spacebar instance.";

function getTeamRepository(repository?: TeamPayoutOnboardingRepository): TeamPayoutOnboardingRepository {
    return repository ?? (Team as unknown as TeamPayoutOnboardingRepository);
}

export function canAccessTeamPayoutOnboarding(team: TeamPayoutOnboardingTarget, userId: string) {
    return team.owner_user_id === userId;
}

export function createTeamPayoutOnboardingUnsupportedError(): ApiError {
    return new ApiError(TEAM_PAYOUT_ONBOARDING_UNSUPPORTED_MESSAGE, 0, 501);
}

export async function getTeamPayoutOnboarding(teamId: string, userId: string, repositories: TeamPayoutOnboardingRepositories = {}): Promise<never> {
    const teamRepository = getTeamRepository(repositories.teamRepository);
    const team = await teamRepository.findOne({
        where: { id: teamId },
        select: { owner_user_id: true },
    });

    if (!team) throw UNKNOWN_TEAM_PAYOUT_ONBOARDING_TEAM_ERROR;
    if (!canAccessTeamPayoutOnboarding(team, userId)) throw MISSING_TEAM_PAYOUT_ONBOARDING_ACCESS_ERROR;

    // Discord returns a provider-backed Tipalti payee dashboard URL. Spacebar
    // does not persist payout onboarding state or integrate with a payout
    // provider, so fail closed instead of fabricating a dashboard URL.
    throw createTeamPayoutOnboardingUnsupportedError();
}

export function createTeamPayoutOnboardingRouter(repositories: TeamPayoutOnboardingRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Team Payout Onboarding",
            description:
                "Returns a Tipalti payee dashboard URL for team payout onboarding. This Discord endpoint depends on provider-backed payout onboarding state; Spacebar does not currently persist that state or integrate with a payout provider, so this compatibility endpoint fails closed after owner access checks.",
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
            await getTeamPayoutOnboarding(req.params.team_id as string, req.user_id, repositories);
        },
    );

    return router;
}

export default createTeamPayoutOnboardingRouter();
