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
import type { ApplicationAssetsResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { type Request, type Response, Router } from "express";
import { requireApplicationAssetAccess, type ApplicationCommandAuthorizationRepository } from "../../../../../util/utility/ApplicationAuthorization";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export type ApplicationAssetListDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
};

export function isApplicationAssetListRouteSnowflake(value: string) {
    return routeSnowflakePattern.test(value);
}

export async function getApplicationAssets(
    applicationId: string,
    userId: string,
    dependencies: ApplicationAssetListDependencies = {},
): Promise<ApplicationAssetsResponse> {
    if (!isApplicationAssetListRouteSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    await requireApplicationAssetAccess(applicationId, userId, dependencies.applicationRepository);

    // Spacebar does not currently persist Discord's application asset catalog.
    return [];
}

function sendApplicationAuthorizationError(res: Response) {
    return res.status(403).json({
        code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

export function createOAuth2ApplicationAssetsRouter(dependencies: ApplicationAssetListDependencies = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Assets",
            description: "Returns the persisted application asset catalog for the given application.",
            query: {
                nocache: {
                    type: "boolean",
                    description: "Whether to bypass cache for the response.",
                },
            },
            responses: {
                200: {
                    body: "ApplicationAssetsResponse",
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
            try {
                const assets = await getApplicationAssets(req.params.application_id as string, req.user_id, dependencies);

                return res.status(200).json(assets);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createOAuth2ApplicationAssetsRouter();
