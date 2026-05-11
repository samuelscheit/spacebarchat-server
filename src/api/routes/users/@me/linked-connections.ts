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
import type { LinkedConnectionsResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const LINKED_CONNECTIONS_REQUIRED_SCOPE = "connections";

type OAuthLinkedConnectionsToken = {
    scope?: unknown;
    scopes?: unknown;
    scp?: unknown;
    application_id?: unknown;
    client_id?: unknown;
    azp?: unknown;
    aud?: unknown;
    application?: unknown;
};

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

export function getOAuthLinkedConnectionScopes(token: unknown): string[] {
    if (!token || typeof token !== "object") return [];

    const scopeToken = token as OAuthLinkedConnectionsToken;
    return [...new Set([...scopeValues(scopeToken.scope), ...scopeValues(scopeToken.scopes), ...scopeValues(scopeToken.scp)])];
}

export function getOAuthLinkedConnectionsApplicationId(token: unknown): string | undefined {
    if (!token || typeof token !== "object") return undefined;

    const scopeToken = token as OAuthLinkedConnectionsToken;
    return (
        stringValue(scopeToken.application_id) ??
        stringValue(scopeToken.client_id) ??
        nestedApplicationId(scopeToken.application) ??
        stringValue(scopeToken.azp) ??
        stringValue(scopeToken.aud)
    );
}

export function assertOAuthLinkedConnectionsToken(token: unknown): string {
    if (!getOAuthLinkedConnectionScopes(token).includes(LINKED_CONNECTIONS_REQUIRED_SCOPE)) throw DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE;

    const applicationId = getOAuthLinkedConnectionsApplicationId(token);
    if (!applicationId) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;

    return applicationId;
}

router.get(
    "/",
    route({
        summary: "Get User Linked Connections",
        responses: {
            200: {
                body: "LinkedConnectionsResponse",
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
        assertOAuthLinkedConnectionsToken(req.token);

        // Spacebar does not persist Discord's application-scoped linked connection
        // grants yet. Return only data that is locally backed; today that is none.
        return res.json([] satisfies LinkedConnectionsResponse);
    },
);

export default router;
