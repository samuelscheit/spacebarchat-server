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
import type { ApplicationExternalIdentityProviderConfigurationsResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";
import { requireApplicationBranchAccess, type ApplicationCommandAuthorizationRepository } from "../../../util/utility/ApplicationAuthorization";

export type ApplicationExternalIdentityProviderConfigurationsRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
};

export function buildApplicationExternalIdentityProviderConfigurationsResponse(): ApplicationExternalIdentityProviderConfigurationsResponse {
    return [];
}

export async function getApplicationExternalIdentityProviderConfigurations(
    applicationId: string,
    userId: string,
    repositories: ApplicationExternalIdentityProviderConfigurationsRepositories = {},
): Promise<ApplicationExternalIdentityProviderConfigurationsResponse> {
    await requireApplicationBranchAccess(applicationId, userId, repositories.applicationRepository);

    return buildApplicationExternalIdentityProviderConfigurationsResponse();
}

export function createApplicationExternalIdentityProviderConfigurationsRouter(repositories: ApplicationExternalIdentityProviderConfigurationsRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application External Identity Provider Configurations",
            description: "Returns the locally available external identity provider configurations for the given application.",
            responses: {
                200: {
                    body: "ApplicationExternalIdentityProviderConfigurationsResponse",
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
            const response = await getApplicationExternalIdentityProviderConfigurations(req.params.application_id as string, req.user_id, repositories);

            return res.status(200).json(response);
        },
    );

    return router;
}

export default createApplicationExternalIdentityProviderConfigurationsRouter();
