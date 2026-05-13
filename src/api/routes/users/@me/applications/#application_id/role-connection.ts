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
import type { ApplicationRoleConnectionModifySchema, ApplicationRoleConnectionResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE = "role_connections.write";
export const APPLICATION_ROLE_CONNECTION_UPDATE_UNSUPPORTED_MESSAGE = "User application role connection updates are not supported on this Spacebar instance.";

type OAuthApplicationRoleConnectionToken = {
    scope?: unknown;
    scopes?: unknown;
    scp?: unknown;
    application_id?: unknown;
    client_id?: unknown;
    azp?: unknown;
    aud?: unknown;
    application?: unknown;
};

export type ApplicationRoleConnectionProvider = (userId: string, applicationId: string) => ApplicationRoleConnectionResponse | Promise<ApplicationRoleConnectionResponse>;
export type NormalizedApplicationRoleConnectionModify = {
    platform_name: string | null;
    platform_username: string | null;
    metadata: Record<string, string>;
};
export type ApplicationRoleConnectionUpdater = (
    userId: string,
    applicationId: string,
    body: NormalizedApplicationRoleConnectionModify,
) => ApplicationRoleConnectionResponse | Promise<ApplicationRoleConnectionResponse>;

function scopeValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(scopeValues);
    if (typeof value !== "string") return [];

    return value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

function stringValue(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nestedApplicationId(value: unknown): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    return stringValue((value as { id?: unknown }).id);
}

export function getOAuthApplicationRoleConnectionScopes(token: unknown): string[] {
    if (!token || typeof token !== "object") return [];

    const scopeToken = token as OAuthApplicationRoleConnectionToken;
    return [...new Set([...scopeValues(scopeToken.scope), ...scopeValues(scopeToken.scopes), ...scopeValues(scopeToken.scp)])];
}

export function getOAuthApplicationRoleConnectionApplicationId(token: unknown): string | undefined {
    if (!token || typeof token !== "object") return undefined;

    const scopeToken = token as OAuthApplicationRoleConnectionToken;
    return (
        stringValue(scopeToken.application_id) ??
        stringValue(scopeToken.client_id) ??
        nestedApplicationId(scopeToken.application) ??
        stringValue(scopeToken.azp) ??
        stringValue(scopeToken.aud)
    );
}

export function assertOAuthApplicationRoleConnectionToken(token: unknown, applicationId: string): void {
    if (!getOAuthApplicationRoleConnectionScopes(token).includes(APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE)) throw DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE;
    if (getOAuthApplicationRoleConnectionApplicationId(token) !== applicationId) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;
}

export function getCurrentUserApplicationRoleConnection(_userId: string, _applicationId: string): ApplicationRoleConnectionResponse {
    return {
        platform_name: null,
        platform_username: null,
        metadata: {},
    };
}

export function normalizeApplicationRoleConnectionModify(body: ApplicationRoleConnectionModifySchema): NormalizedApplicationRoleConnectionModify {
    return {
        platform_name: body.platform_name ?? null,
        platform_username: body.platform_username ?? null,
        metadata: body.metadata ? { ...body.metadata } : {},
    };
}

export function validateApplicationRoleConnectionModify(body: ApplicationRoleConnectionModifySchema): void {
    if (!body.metadata) return;

    for (const [key, value] of Object.entries(body.metadata)) {
        if (value.length > 100) {
            throw FieldErrors({
                [`metadata.${key}`]: {
                    code: "BASE_TYPE_BAD_LENGTH",
                    message: "metadata values must be 100 characters or fewer",
                },
            });
        }
    }
}

export function createApplicationRoleConnectionUpdateUnsupportedError(): ApiError {
    return new ApiError(APPLICATION_ROLE_CONNECTION_UPDATE_UNSUPPORTED_MESSAGE, 0, 501);
}

export function updateCurrentUserApplicationRoleConnection(_userId: string, _applicationId: string, _body: NormalizedApplicationRoleConnectionModify): never {
    // Spacebar does not currently persist per-user external role connection state.
    // Returning the request payload as if it were stored would make subsequent GETs lie.
    throw createApplicationRoleConnectionUpdateUnsupportedError();
}

export function registerApplicationRoleConnectionRoute(
    router: Router,
    provider: ApplicationRoleConnectionProvider = getCurrentUserApplicationRoleConnection,
    updater: ApplicationRoleConnectionUpdater = updateCurrentUserApplicationRoleConnection,
) {
    router.get(
        "/",
        route({
            summary: "Get User Application Role Connection",
            responses: {
                200: {
                    body: "ApplicationRoleConnectionResponse",
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
            const { application_id } = req.params as { [key: string]: string };

            assertOAuthApplicationRoleConnectionToken(req.token, application_id);

            return res.json(await provider(req.user_id, application_id));
        },
    );

    router.put(
        "/",
        route({
            requestBody: "ApplicationRoleConnectionModifySchema",
            coerceRequestBody: false,
            summary: "Modify User Application Role Connection",
            description:
                "Replaces the authenticated user's application role connection for the OAuth2 application in the path. Spacebar validates the documented nullable payload and token scope, then requires durable role-connection backing state; the default instance fails closed instead of fabricating a persisted platform connection.",
            responses: {
                200: {
                    body: "ApplicationRoleConnectionResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { application_id } = req.params as { [key: string]: string };
            const body = req.body as ApplicationRoleConnectionModifySchema;

            assertOAuthApplicationRoleConnectionToken(req.token, application_id);
            validateApplicationRoleConnectionModify(body);

            return res.json(await updater(req.user_id, application_id, normalizeApplicationRoleConnectionModify(body)));
        },
    );

    return router;
}

export function createApplicationRoleConnectionRouter(
    provider: ApplicationRoleConnectionProvider = getCurrentUserApplicationRoleConnection,
    updater: ApplicationRoleConnectionUpdater = updateCurrentUserApplicationRoleConnection,
) {
    return registerApplicationRoleConnectionRoute(Router({ mergeParams: true }), provider, updater);
}

export default createApplicationRoleConnectionRouter();
