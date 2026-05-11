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
import { TeamMemberState, type TeamMembersResponse } from "@spacebar/schemas";
import { ApiError, Team } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { serializeTeamMembersResponse } from "../../../util/handlers/Team";

export type TeamMembersMember = TeamMembersResponse[number];

export type TeamMembersTarget = {
    members?: TeamMembersMember[] | null;
    owner_user_id?: string | null;
};

export type TeamMembersRepository = {
    findOne(options: unknown): Promise<TeamMembersTarget | null>;
};

export type TeamMembersRepositories = {
    teamRepository?: TeamMembersRepository;
};

export const UNKNOWN_TEAM_MEMBERS_ERROR = new ApiError("Unknown Team", 10039, 404);
export const MISSING_TEAM_MEMBERS_ACCESS_ERROR = new ApiError("Missing Access", 50001, 403);

function getTeamRepository(repository?: TeamMembersRepository): TeamMembersRepository {
    return repository ?? (Team as unknown as TeamMembersRepository);
}

export function canAccessTeamMembers(team: TeamMembersTarget, userId: string) {
    if (team.owner_user_id === userId) return true;

    return team.members?.some((member) => member.user_id === userId && member.membership_state === TeamMemberState.ACCEPTED) ?? false;
}

export async function getTeamMembers(teamId: string, userId: string, repositories: TeamMembersRepositories = {}): Promise<TeamMembersResponse> {
    const teamRepository = getTeamRepository(repositories.teamRepository);
    const team = await teamRepository.findOne({
        where: { id: teamId },
        relations: { members: true },
    });

    if (!team) throw UNKNOWN_TEAM_MEMBERS_ERROR;
    if (!canAccessTeamMembers(team, userId)) throw MISSING_TEAM_MEMBERS_ACCESS_ERROR;

    return serializeTeamMembersResponse(team.members ?? []);
}

export function createTeamMembersRouter(repositories: TeamMembersRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Team Members",
            responses: {
                200: {
                    body: "TeamMembersResponse",
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
            const members = await getTeamMembers(req.params.team_id as string, req.user_id, repositories);
            return res.status(200).json(members);
        },
    );

    return router;
}

export default createTeamMembersRouter();
