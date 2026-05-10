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
import type { ApplicationIdentitiesResponse, ApplicationIdentitiesSchema } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

const snowflakePattern = /^\d{1,20}$/;

type OAuthApplicationToken = {
    application_id?: unknown;
    client_id?: unknown;
    azp?: unknown;
    aud?: unknown;
    application?: unknown;
};

function stringValue(value: unknown): string | undefined {
    return typeof value === "string" && value ? value : undefined;
}

function nestedApplicationId(value: unknown): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    return stringValue((value as { id?: unknown }).id);
}

export function getOAuthApplicationId(token: unknown): string | undefined {
    if (!token || typeof token !== "object") return undefined;

    const applicationToken = token as OAuthApplicationToken;
    return (
        stringValue(applicationToken.application_id) ??
        stringValue(applicationToken.client_id) ??
        nestedApplicationId(applicationToken.application) ??
        stringValue(applicationToken.azp) ??
        stringValue(applicationToken.aud)
    );
}

export function assertOAuthApplicationToken(token: unknown): void {
    if (!getOAuthApplicationId(token)) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;
}

export function normalizeApplicationIdentityUserIds(userIds: readonly string[]): string[] {
    return [...new Set(userIds.filter((userId) => snowflakePattern.test(userId)))];
}

router.post(
    "/",
    route({
        summary: "Get Bulk Application Identities",
        requestBody: "ApplicationIdentitiesSchema",
        coerceRequestBody: false,
        responses: {
            200: {
                body: "ApplicationIdentitiesResponse",
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
        const body = req.body as ApplicationIdentitiesSchema;

        assertOAuthApplicationToken(req.token);

        // Spacebar does not yet persist application-scoped external identities.
        normalizeApplicationIdentityUserIds(body.user_ids);
        const identities: ApplicationIdentitiesResponse = [];

        return res.json(identities);
    },
);

export default router;
