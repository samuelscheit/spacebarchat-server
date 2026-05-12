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
import type { ApplicationBranchesResponse, ApplicationBranchesSchema } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

export type ApplicationBranchLookupOptions = {
    branchIds: string[];
    userId: string;
};

export type ApplicationBranchLookupRepository = {
    findBranchesByIds(options: ApplicationBranchLookupOptions): Promise<ApplicationBranchesResponse>;
};

export type ApplicationBranchesRepositories = {
    branchRepository?: ApplicationBranchLookupRepository;
};

function uniqueBranchIds(branchIds: readonly string[]): string[] {
    return [...new Set(branchIds)];
}

function filterRequestedBranches(branches: ApplicationBranchesResponse, branchIds: readonly string[]): ApplicationBranchesResponse {
    const requested = new Set(branchIds);
    const seen = new Set<string>();

    return branches.filter((branch) => {
        if (!requested.has(branch.id) || seen.has(branch.id)) return false;
        seen.add(branch.id);
        return true;
    });
}

export async function getApplicationBranchesByIds(
    branchIds: readonly string[],
    userId: string,
    repositories: ApplicationBranchesRepositories = {},
): Promise<ApplicationBranchesResponse> {
    const requestedBranchIds = uniqueBranchIds(branchIds);
    if (!requestedBranchIds.length) return [];

    const branches = await repositories.branchRepository?.findBranchesByIds({
        branchIds: requestedBranchIds,
        userId,
    });

    if (!branches) return [];
    return filterRequestedBranches(branches, requestedBranchIds);
}

export function createApplicationBranchesLookupRouter(repositories: ApplicationBranchesRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Get Application Branch Live Build IDs",
            description:
                "Returns branch records for requested application branch IDs. Spacebar does not currently persist application branch build metadata, so the default provider returns no branch records.",
            requestBody: "ApplicationBranchesSchema",
            coerceRequestBody: false,
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
            },
        }),
        async (req: Request, res: Response) => {
            const body = req.body as ApplicationBranchesSchema;
            const branches = await getApplicationBranchesByIds(body.branch_ids, req.user_id, repositories);

            return res.status(200).json(branches);
        },
    );

    return router;
}

export default createApplicationBranchesLookupRouter();
