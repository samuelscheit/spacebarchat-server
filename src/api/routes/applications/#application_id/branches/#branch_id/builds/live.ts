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

import type { ApplicationLiveBuildResponse } from "@spacebar/schemas";
import { route } from "@spacebar/api";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { requireApplicationBranchAccess, type ApplicationCommandAuthorizationRepository } from "../../../../../../util/utility/ApplicationAuthorization";

export const UNKNOWN_APPLICATION_LIVE_BUILD_ERROR = new ApiError(DiscordApiErrors.UNKNOWN_BUILD.message, DiscordApiErrors.UNKNOWN_BUILD.code, 404);

export type ApplicationLiveBuildLookupOptions = {
    applicationId: string;
    branchId: string;
    platform?: string;
    locale?: string;
};

export type ApplicationLiveBuildRepository = {
    findLiveBuild(options: ApplicationLiveBuildLookupOptions): Promise<ApplicationLiveBuildResponse | null>;
};

export type ApplicationLiveBuildRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    liveBuildRepository?: ApplicationLiveBuildRepository;
};

function firstQueryValue(value: unknown) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    return undefined;
}

export async function getApplicationLiveBuild(
    applicationId: string,
    branchId: string,
    userId: string,
    options: { platform?: string; locale?: string } = {},
    repositories: ApplicationLiveBuildRepositories = {},
): Promise<ApplicationLiveBuildResponse> {
    await requireApplicationBranchAccess(applicationId, userId, repositories.applicationRepository);

    const liveBuild = await repositories.liveBuildRepository?.findLiveBuild({
        applicationId,
        branchId,
        platform: options.platform,
        locale: options.locale,
    });

    if (liveBuild) return liveBuild;
    throw UNKNOWN_APPLICATION_LIVE_BUILD_ERROR;
}

export function createApplicationLiveBuildRouter(repositories: ApplicationLiveBuildRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            query: {
                platform: {
                    type: "string",
                    required: false,
                },
                locale: {
                    type: "string",
                    required: false,
                },
            },
            responses: {
                200: {
                    body: "ApplicationLiveBuildResponse",
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
            const build = await getApplicationLiveBuild(
                req.params.application_id as string,
                req.params.branch_id as string,
                req.user_id,
                {
                    platform: firstQueryValue(req.query.platform),
                    locale: firstQueryValue(req.query.locale),
                },
                repositories,
            );

            return res.status(200).json(build);
        },
    );

    return router;
}

export default createApplicationLiveBuildRouter();
