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
import type { ApplicationRoleConnectionResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const APPLICATION_ROLE_CONNECTIONS_REQUIRED_SCOPE = "role_connections.write";

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

export function registerApplicationRoleConnectionRoute(router: Router, provider: ApplicationRoleConnectionProvider = getCurrentUserApplicationRoleConnection) {
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

    return router;
}

export function createApplicationRoleConnectionRouter(provider: ApplicationRoleConnectionProvider = getCurrentUserApplicationRoleConnection) {
    return registerApplicationRoleConnectionRoute(Router({ mergeParams: true }), provider);
}

export default createApplicationRoleConnectionRouter();
