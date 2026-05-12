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
import type { UserApplicationProfileResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { type Request, type Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router({ mergeParams: true });

type OAuthApplicationProfileToken = {
    application_id?: unknown;
    client_id?: unknown;
    azp?: unknown;
    aud?: unknown;
    application?: unknown;
};

export type UserApplicationProfileProvider = (
    applicationId: string,
    userId: string,
    externalUserId: string,
) => UserApplicationProfileResponse | null | undefined | Promise<UserApplicationProfileResponse | null | undefined>;

function stringValue(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nestedApplicationId(value: unknown): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    return stringValue((value as { id?: unknown }).id);
}

export function getOAuthApplicationProfileApplicationId(token: unknown): string | undefined {
    if (!token || typeof token !== "object") return undefined;

    const applicationToken = token as OAuthApplicationProfileToken;
    return (
        stringValue(applicationToken.application_id) ??
        stringValue(applicationToken.client_id) ??
        nestedApplicationId(applicationToken.application) ??
        stringValue(applicationToken.azp) ??
        stringValue(applicationToken.aud)
    );
}

export function assertOAuthApplicationProfileToken(token: unknown, applicationId: string): void {
    if (getOAuthApplicationProfileApplicationId(token) !== applicationId) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;
}

export function getLocalUserApplicationProfile(_applicationId: string, _userId: string, _externalUserId: string): UserApplicationProfileResponse | undefined {
    // Spacebar does not yet persist durable application-scoped external identity profiles.
    return undefined;
}

export async function getUserApplicationProfileForRequest(
    applicationId: string,
    userId: string,
    externalUserId: string,
    token: unknown,
    provider: UserApplicationProfileProvider = getLocalUserApplicationProfile,
): Promise<UserApplicationProfileResponse> {
    assertOAuthApplicationProfileToken(token, applicationId);

    const profile = await provider(applicationId, userId, externalUserId);
    if (!profile) throw new HTTPError("Unknown user application profile", 404);

    return profile;
}

export function registerUserApplicationProfileRoute(router: Router, provider: UserApplicationProfileProvider = getLocalUserApplicationProfile) {
    router.get(
        "/",
        route({
            summary: "Get User Application Profile",
            description:
                "Returns a locally backed user application profile for the given application, user, and external user IDs. Spacebar does not fabricate profiles for unsupported external provider state.",
            responses: {
                200: {
                    body: "UserApplicationProfileResponse",
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
            const { application_id, user_id, external_user_id } = req.params as { [key: string]: string };
            const response = await getUserApplicationProfileForRequest(application_id, user_id, external_user_id, req.token, provider);

            return res.status(200).json(response);
        },
    );

    return router;
}

export function createUserApplicationProfileRouter(provider: UserApplicationProfileProvider = getLocalUserApplicationProfile) {
    return registerUserApplicationProfileRoute(Router({ mergeParams: true }), provider);
}

export default registerUserApplicationProfileRoute(router);
