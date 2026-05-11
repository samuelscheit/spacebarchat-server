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
import { TeamMemberState } from "@spacebar/schemas";
import { ApiError, Team } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type TeamIdentityVerificationMember = {
    membership_state: TeamMemberState;
    user_id?: string | null;
};

export type TeamIdentityVerificationTarget = {
    members?: TeamIdentityVerificationMember[] | null;
    owner_user_id?: string | null;
};

export type TeamIdentityVerificationRepository = {
    findOne(options: unknown): Promise<TeamIdentityVerificationTarget | null>;
};

export type TeamIdentityVerificationRepositories = {
    teamRepository?: TeamIdentityVerificationRepository;
};

export const UNKNOWN_TEAM_IDENTITY_VERIFICATION_TEAM_ERROR = new ApiError("Unknown Team", 10039, 404);
export const MISSING_TEAM_IDENTITY_VERIFICATION_ACCESS_ERROR = new ApiError("Missing Access", 50001, 403);
export const TEAM_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE = "Team identity verification is not supported on this Spacebar instance.";

function getTeamRepository(repository?: TeamIdentityVerificationRepository): TeamIdentityVerificationRepository {
    return repository ?? (Team as unknown as TeamIdentityVerificationRepository);
}

export function canAccessTeamIdentityVerification(team: TeamIdentityVerificationTarget, userId: string) {
    if (team.owner_user_id === userId) return true;

    return team.members?.some((member) => member.user_id === userId && member.membership_state === TeamMemberState.ACCEPTED) ?? false;
}

export function createTeamIdentityVerificationUnsupportedError(): ApiError {
    return new ApiError(TEAM_IDENTITY_VERIFICATION_UNSUPPORTED_MESSAGE, 0, 501);
}

export async function getTeamIdentityVerification(teamId: string, userId: string, repositories: TeamIdentityVerificationRepositories = {}): Promise<never> {
    const teamRepository = getTeamRepository(repositories.teamRepository);
    const team = await teamRepository.findOne({
        where: { id: teamId },
        relations: { members: true },
    });

    if (!team) throw UNKNOWN_TEAM_IDENTITY_VERIFICATION_TEAM_ERROR;
    if (!canAccessTeamIdentityVerification(team, userId)) throw MISSING_TEAM_IDENTITY_VERIFICATION_ACCESS_ERROR;

    // Discord returns the latest Stripe-backed identity verification attempt.
    // Spacebar has no provider integration or durable verification-attempt
    // state, so fail closed instead of fabricating a Discord verification.
    throw createTeamIdentityVerificationUnsupportedError();
}

export function createTeamIdentityVerificationRouter(repositories: TeamIdentityVerificationRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Team Identity Verification",
            description:
                "Returns the most recent team identity verification attempt. This Discord endpoint depends on Stripe identity attempt state; Spacebar does not currently persist that state or integrate with an identity provider, so this compatibility endpoint fails closed after team access checks.",
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
            await getTeamIdentityVerification(req.params.team_id as string, req.user_id, repositories);
        },
    );

    return router;
}

export default createTeamIdentityVerificationRouter();
