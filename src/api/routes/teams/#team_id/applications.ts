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

import { TeamMemberState, type APIApplicationArray } from "@spacebar/schemas";
import { route } from "@spacebar/api";
import { ApiError, Application, Team } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type TeamApplicationsMember = {
    user_id?: string | null;
    membership_state: TeamMemberState;
};

export type TeamApplicationsAuthorizationTarget = {
    owner_user_id?: string | null;
    members?: TeamApplicationsMember[] | null;
};

export type TeamApplicationsTeamRepository = {
    findOne(options: unknown): Promise<TeamApplicationsAuthorizationTarget | null>;
};

export type TeamApplicationsApplicationRepository = {
    find(options: unknown): Promise<APIApplicationArray>;
};

export type TeamApplicationsRepositories = {
    teamRepository?: TeamApplicationsTeamRepository;
    applicationRepository?: TeamApplicationsApplicationRepository;
};

export const UNKNOWN_TEAM_APPLICATIONS_ERROR = new ApiError("Unknown Team", 10039, 404);
export const MISSING_TEAM_APPLICATIONS_ACCESS_ERROR = new ApiError("Missing Access", 50001, 403);

function getTeamRepository(repository?: TeamApplicationsTeamRepository): TeamApplicationsTeamRepository {
    return repository ?? (Team as unknown as TeamApplicationsTeamRepository);
}

function getApplicationRepository(repository?: TeamApplicationsApplicationRepository): TeamApplicationsApplicationRepository {
    return repository ?? (Application as unknown as TeamApplicationsApplicationRepository);
}

export function canAccessTeamApplications(team: TeamApplicationsAuthorizationTarget, userId: string) {
    if (team.owner_user_id === userId) return true;

    return team.members?.some((member) => member.user_id === userId && member.membership_state === TeamMemberState.ACCEPTED) ?? false;
}

export async function getTeamApplications(teamId: string, userId: string, repositories: TeamApplicationsRepositories = {}): Promise<APIApplicationArray> {
    const teamRepository = getTeamRepository(repositories.teamRepository);
    const applicationRepository = getApplicationRepository(repositories.applicationRepository);

    const team = await teamRepository.findOne({
        where: { id: teamId },
        relations: { members: true },
    });

    if (!team) throw UNKNOWN_TEAM_APPLICATIONS_ERROR;
    if (!canAccessTeamApplications(team, userId)) throw MISSING_TEAM_APPLICATIONS_ACCESS_ERROR;

    return applicationRepository.find({
        where: { team: { id: teamId } },
        relations: { owner: true, bot: true },
        order: { id: "ASC" },
    });
}

export function createTeamApplicationsRouter(repositories: TeamApplicationsRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Team Applications",
            responses: {
                200: {
                    body: "APIApplicationArray",
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
            const applications = await getTeamApplications(req.params.team_id as string, req.user_id, repositories);

            return res.status(200).json(applications);
        },
    );

    return router;
}

export default createTeamApplicationsRouter();
