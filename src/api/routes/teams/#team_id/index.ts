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
import { TeamMemberState, type TeamResponse } from "@spacebar/schemas";
import { ApiError, Team } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { serializeTeamResponse } from "../../../util/handlers/Team";

export type TeamGetMember = {
    id: string;
    membership_state: TeamMemberState;
    permissions: string[];
    role: TeamResponse["members"][number]["role"];
    team_id: string;
    user_id: string;
};

export type TeamGetTarget = {
    id: string;
    icon?: string | null;
    members?: TeamGetMember[] | null;
    name: string;
    owner_user_id: string;
};

export type TeamGetRepository = {
    findOne(options: unknown): Promise<TeamGetTarget | null>;
};

export type TeamGetRepositories = {
    teamRepository?: TeamGetRepository;
};

export const UNKNOWN_TEAM_ERROR = new ApiError("Unknown Team", 10039, 404);
export const MISSING_TEAM_ACCESS_ERROR = new ApiError("Missing Access", 50001, 403);

function getTeamRepository(repository?: TeamGetRepository): TeamGetRepository {
    return repository ?? (Team as unknown as TeamGetRepository);
}

export function canAccessTeam(team: Pick<TeamGetTarget, "members" | "owner_user_id">, userId: string) {
    if (team.owner_user_id === userId) return true;

    return team.members?.some((member) => member.user_id === userId && member.membership_state === TeamMemberState.ACCEPTED) ?? false;
}

export async function getTeam(teamId: string, userId: string, repositories: TeamGetRepositories = {}): Promise<TeamResponse> {
    const teamRepository = getTeamRepository(repositories.teamRepository);
    const team = await teamRepository.findOne({
        where: { id: teamId },
        relations: { members: true },
    });

    if (!team) throw UNKNOWN_TEAM_ERROR;
    if (!canAccessTeam(team, userId)) throw MISSING_TEAM_ACCESS_ERROR;

    return serializeTeamResponse({
        ...team,
        members: team.members ?? [],
    });
}

export function createTeamRouter(repositories: TeamGetRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Team",
            query: {
                include_payout_account_status: {
                    type: "boolean",
                    description: "Whether to include team payout account status in the response (default false)",
                },
            },
            responses: {
                200: {
                    body: "TeamResponse",
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
            const team = await getTeam(req.params.team_id as string, req.user_id, repositories);
            return res.status(200).json(team);
        },
    );

    return router;
}

export default createTeamRouter();
