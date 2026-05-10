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

import { parseBooleanQuery, route } from "@spacebar/api";
import { TeamMemberState, type APIApplication, type ApplicationsWithAssetsResponse } from "@spacebar/schemas";
import { Application, Team } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { In } from "typeorm";

export type ApplicationsWithAssetsApplicationRepository = {
    find(options: unknown): Promise<APIApplication[]>;
};

export type ApplicationsWithAssetsTeam = {
    id: string;
};

export type ApplicationsWithAssetsTeamRepository = {
    find(options: unknown): Promise<ApplicationsWithAssetsTeam[]>;
};

export type ApplicationsWithAssetsRepositories = {
    applicationRepository?: ApplicationsWithAssetsApplicationRepository;
    teamRepository?: ApplicationsWithAssetsTeamRepository;
};

function getApplicationRepository(repository?: ApplicationsWithAssetsApplicationRepository): ApplicationsWithAssetsApplicationRepository {
    return repository ?? (Application as unknown as ApplicationsWithAssetsApplicationRepository);
}

function getTeamRepository(repository?: ApplicationsWithAssetsTeamRepository): ApplicationsWithAssetsTeamRepository {
    return repository ?? (Team as unknown as ApplicationsWithAssetsTeamRepository);
}

export function parseApplicationsWithAssetsIncludeTeams(query: Request["query"]): boolean {
    return parseBooleanQuery(query.with_team_applications);
}

export function buildApplicationsWithAssetsResponse(applications: APIApplication[]): ApplicationsWithAssetsResponse {
    return {
        applications,
        // Spacebar does not currently persist Discord's application asset catalog.
        assets: {},
    };
}

function dedupeApplications(applications: APIApplication[]): APIApplication[] {
    const seen = new Set<string>();
    const result: APIApplication[] = [];

    for (const application of applications) {
        if (seen.has(application.id)) continue;
        seen.add(application.id);
        result.push(application);
    }

    return result;
}

export async function getApplicationsWithAssets(
    userId: string,
    includeTeamApplications: boolean,
    repositories: ApplicationsWithAssetsRepositories = {},
): Promise<ApplicationsWithAssetsResponse> {
    const applicationRepository = getApplicationRepository(repositories.applicationRepository);
    const teamRepository = getTeamRepository(repositories.teamRepository);

    const ownedApplications = await applicationRepository.find({
        where: { owner: { id: userId } },
        relations: { owner: true, bot: true },
        order: { id: "ASC" },
    });

    if (!includeTeamApplications) return buildApplicationsWithAssetsResponse(ownedApplications);

    const teams = await teamRepository.find({
        where: [
            { owner_user_id: userId },
            {
                members: {
                    user_id: userId,
                    membership_state: TeamMemberState.ACCEPTED,
                },
            },
        ],
        relations: { members: true },
        select: { id: true },
        order: { id: "ASC" },
    });

    const teamIds = teams.map((team) => team.id);
    if (teamIds.length === 0) return buildApplicationsWithAssetsResponse(ownedApplications);

    const teamApplications = await applicationRepository.find({
        where: { team: { id: In(teamIds) } },
        relations: { owner: true, bot: true },
        order: { id: "ASC" },
    });

    return buildApplicationsWithAssetsResponse(dedupeApplications([...ownedApplications, ...teamApplications]));
}

export function createApplicationsWithAssetsRouter(repositories: ApplicationsWithAssetsRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Applications with Assets",
            query: {
                with_team_applications: {
                    type: "boolean",
                    description: "Whether to include applications from teams the current user can access.",
                },
            },
            responses: {
                200: {
                    body: "ApplicationsWithAssetsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const response = await getApplicationsWithAssets(req.user_id, parseApplicationsWithAssetsIncludeTeams(req.query), repositories);

            return res.status(200).json(response);
        },
    );

    return router;
}

export default createApplicationsWithAssetsRouter();
