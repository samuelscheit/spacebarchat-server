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
import { TeamMemberRole, TeamMemberState } from "@spacebar/schemas";
import { Application, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const applicationTestModeTeamRoles = new Set<TeamMemberRole>([TeamMemberRole.ADMIN, TeamMemberRole.DEVELOPER]);

export type ApplicationTestModeTeamMember = {
    user_id?: string | null;
    membership_state: TeamMemberState;
    role?: TeamMemberRole | null;
};

export type ApplicationTestModeAuthorizationTarget = {
    owner?: { id?: string | null } | null;
    team?: {
        owner_user_id?: string | null;
        members?: ApplicationTestModeTeamMember[] | null;
    } | null;
};

export type ApplicationTestModeRepository = {
    findOne(options: unknown): Promise<ApplicationTestModeAuthorizationTarget | null>;
};

export type ApplicationTestModeRepositories = {
    applicationRepository?: ApplicationTestModeRepository;
};

function getApplicationRepository(repository?: ApplicationTestModeRepository): ApplicationTestModeRepository {
    return repository ?? (Application as unknown as ApplicationTestModeRepository);
}

export function canUseApplicationTestMode(application: ApplicationTestModeAuthorizationTarget, userId: string) {
    if (application.owner?.id === userId) return true;

    const team = application.team;
    if (!team) return false;
    if (team.owner_user_id === userId) return true;

    return (
        team.members?.some(
            (member) => member.user_id === userId && member.membership_state === TeamMemberState.ACCEPTED && !!member.role && applicationTestModeTeamRoles.has(member.role),
        ) ?? false
    );
}

export async function requireApplicationTestModeAccess(applicationId: string, userId: string, repositories: ApplicationTestModeRepositories = {}) {
    const applicationRepository = getApplicationRepository(repositories.applicationRepository);
    const application = await applicationRepository.findOne({
        where: { id: applicationId },
        relations: {
            owner: true,
            team: {
                members: true,
            },
        },
    });

    if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;
    if (!canUseApplicationTestMode(application, userId)) throw DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION;
}

export async function queryApplicationTestMode(applicationId: string, userId: string, repositories: ApplicationTestModeRepositories = {}) {
    await requireApplicationTestModeAccess(applicationId, userId, repositories);
}

export async function setApplicationTestMode(applicationId: string, userId: string, repositories: ApplicationTestModeRepositories = {}) {
    await requireApplicationTestModeAccess(applicationId, userId, repositories);
}

export function createApplicationTestModeRouter(repositories: ApplicationTestModeRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Query Application Test Mode",
            description: "Queries whether the user can use test mode for the application. Spacebar does not persist Discord commerce test-mode state.",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
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
            await queryApplicationTestMode(req.params.application_id as string, req.user_id, repositories);

            return res.sendStatus(204);
        },
    );

    router.post(
        "/",
        route({
            summary: "Set Application Test Mode",
            description: "Validates whether the user can use test mode for the application. Spacebar does not persist Discord commerce test-mode state.",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
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
            await setApplicationTestMode(req.params.application_id as string, req.user_id, repositories);

            return res.sendStatus(204);
        },
    );

    return router;
}

export default createApplicationTestModeRouter();
