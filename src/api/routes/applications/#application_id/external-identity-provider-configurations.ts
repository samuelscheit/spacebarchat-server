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
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { type Request, type Response, Router } from "express";
import {
    requireApplicationBranchAccess,
    requireApplicationExternalIdentityProviderConfigurationManagement,
    type ApplicationCommandAuthorizationRepository,
} from "../../../util/utility/ApplicationAuthorization";

const externalIdentityProviderTypes = new Set(["OIDC", "EPIC_ONLINE_SERVICES", "STEAM", "UNITY", "APPLE", "PLAYSTATION_NETWORK"] as const);

export type ApplicationExternalIdentityProviderType = "OIDC" | "EPIC_ONLINE_SERVICES" | "STEAM" | "UNITY" | "APPLE" | "PLAYSTATION_NETWORK";

export const UNKNOWN_APPLICATION_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATION = new ApiError(DiscordApiErrors.UNKNOWN_PROVIDER.message, DiscordApiErrors.UNKNOWN_PROVIDER.code, 404);

export type ApplicationExternalIdentityProviderConfigurationDeleteOptions = {
    applicationId: string;
    providerType: ApplicationExternalIdentityProviderType;
};

export type ApplicationExternalIdentityProviderConfigurationRepository = {
    deleteConfiguration(options: ApplicationExternalIdentityProviderConfigurationDeleteOptions): Promise<boolean>;
};

export type ApplicationExternalIdentityProviderConfigurationsRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    providerConfigurationRepository?: ApplicationExternalIdentityProviderConfigurationRepository;
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

export function parseApplicationExternalIdentityProviderType(identityProviderType: string): ApplicationExternalIdentityProviderType {
    const normalizedProviderType = identityProviderType.toUpperCase();
    if (!externalIdentityProviderTypes.has(normalizedProviderType as ApplicationExternalIdentityProviderType)) throw DiscordApiErrors.UNKNOWN_PROVIDER;

    return normalizedProviderType as ApplicationExternalIdentityProviderType;
}

async function deletePersistedExternalIdentityProviderConfiguration(
    options: ApplicationExternalIdentityProviderConfigurationDeleteOptions,
    repository?: ApplicationExternalIdentityProviderConfigurationRepository,
) {
    if (repository) return repository.deleteConfiguration(options);

    // Spacebar does not currently persist external identity provider configuration state.
    return false;
}

export async function deleteApplicationExternalIdentityProviderConfiguration(
    applicationId: string,
    userId: string,
    identityProviderType: string,
    repositories: ApplicationExternalIdentityProviderConfigurationsRepositories = {},
): Promise<boolean> {
    await requireApplicationExternalIdentityProviderConfigurationManagement(applicationId, userId, repositories.applicationRepository);

    const providerType = parseApplicationExternalIdentityProviderType(identityProviderType);

    return deletePersistedExternalIdentityProviderConfiguration(
        {
            applicationId,
            providerType,
        },
        repositories.providerConfigurationRepository,
    );
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

    router.delete(
        "/:identity_provider_type",
        route({
            summary: "Remove Application External Identity Provider Configuration",
            description:
                "Removes a locally persisted external identity provider configuration for the given application. Spacebar does not currently persist external identity provider configuration state, so the default backing repository fails closed instead of acknowledging a fabricated deletion.",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
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
                const deleted = await deleteApplicationExternalIdentityProviderConfiguration(
                    req.params.application_id as string,
                    req.user_id,
                    req.params.identity_provider_type as string,
                    repositories,
                );
                if (!deleted) throw UNKNOWN_APPLICATION_EXTERNAL_IDENTITY_PROVIDER_CONFIGURATION;

                return res.status(204).send();
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createApplicationExternalIdentityProviderConfigurationsRouter();
