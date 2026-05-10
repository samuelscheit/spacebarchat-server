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

import { TeamMemberState, type ApplicationCanDeleteResponse } from "@spacebar/schemas";
import { route } from "@spacebar/api";
import { Application, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type ApplicationCanDeleteMember = {
    user_id?: string | null;
    membership_state: TeamMemberState;
};

export type ApplicationCanDeleteAuthorizationTarget = {
    owner?: { id?: string | null } | null;
    team?: {
        owner_user_id?: string | null;
        members?: ApplicationCanDeleteMember[] | null;
    } | null;
};

export type ApplicationCanDeleteRepository = {
    findOne(options: unknown): Promise<ApplicationCanDeleteAuthorizationTarget | null>;
};

export type ApplicationCanDeleteRepositories = {
    applicationRepository?: ApplicationCanDeleteRepository;
};

function getApplicationRepository(repository?: ApplicationCanDeleteRepository): ApplicationCanDeleteRepository {
    return repository ?? (Application as unknown as ApplicationCanDeleteRepository);
}

export function canViewApplicationDeletionState(application: ApplicationCanDeleteAuthorizationTarget, userId: string) {
    if (application.owner?.id === userId) return true;

    const team = application.team;
    if (!team) return false;
    if (team.owner_user_id === userId) return true;

    return team.members?.some((member) => member.user_id === userId && member.membership_state === TeamMemberState.ACCEPTED) ?? false;
}

export function buildApplicationCanDeleteResponse(_application: ApplicationCanDeleteAuthorizationTarget): ApplicationCanDeleteResponse {
    return { deletable: true };
}

export async function getApplicationCanDeleteResponse(
    applicationId: string,
    userId: string,
    repositories: ApplicationCanDeleteRepositories = {},
): Promise<ApplicationCanDeleteResponse> {
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
    if (!canViewApplicationDeletionState(application, userId)) throw DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION;

    return buildApplicationCanDeleteResponse(application);
}

export function createApplicationCanDeleteRouter(repositories: ApplicationCanDeleteRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Undeletable Reason",
            responses: {
                200: {
                    body: "ApplicationCanDeleteResponse",
                },
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
            const response = await getApplicationCanDeleteResponse(req.params.application_id as string, req.user_id, repositories);

            return res.status(200).json(response);
        },
    );

    return router;
}

export default createApplicationCanDeleteRouter();
