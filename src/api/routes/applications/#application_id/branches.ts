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

import type { ApplicationBranchesResponse } from "@spacebar/schemas";
import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { requireApplicationBranchAccess, type ApplicationCommandAuthorizationRepository } from "../../../util/utility/ApplicationAuthorization";

export type ApplicationBranchesRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
};

export async function getApplicationBranches(applicationId: string, userId: string, repositories: ApplicationBranchesRepositories = {}): Promise<ApplicationBranchesResponse> {
    await requireApplicationBranchAccess(applicationId, userId, repositories.applicationRepository);

    return [];
}

export function createApplicationBranchesRouter(repositories: ApplicationBranchesRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            responses: {
                200: {
                    body: "ApplicationBranchesResponse",
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
            const branches = await getApplicationBranches(req.params.application_id as string, req.user_id, repositories);

            return res.status(200).json(branches);
        },
    );

    return router;
}

export default createApplicationBranchesRouter();
