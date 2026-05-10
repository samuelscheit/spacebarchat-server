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
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import type { OAuthAuthorizationResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const oauth2AuthorizationTokenIdPattern = /^[1-9]\d{16,19}$/;

export const UNKNOWN_OAUTH2_AUTHORIZATION = new ApiError(DiscordApiErrors.UNKNOWN_TOKEN.message, DiscordApiErrors.UNKNOWN_TOKEN.code, 404);

export function isOAuth2AuthorizationTokenId(value: unknown): value is string {
    return typeof value === "string" && oauth2AuthorizationTokenIdPattern.test(value);
}

export function assertOAuth2AuthorizationTokenId(value: unknown): asserts value is string {
    if (!isOAuth2AuthorizationTokenId(value)) throw UNKNOWN_OAUTH2_AUTHORIZATION;
}

export async function getOAuth2Authorization(tokenId: string, userId: string): Promise<OAuthAuthorizationResponse | null> {
    assertOAuth2AuthorizationTokenId(tokenId);
    void userId;

    // Spacebar does not currently persist OAuth2 authorization grants by token ID.
    return null;
}

export async function deleteOAuth2Authorization(tokenId: string, userId: string): Promise<boolean> {
    assertOAuth2AuthorizationTokenId(tokenId);
    void userId;

    // Without durable grant storage, do not revoke unrelated sessions or tokens.
    return false;
}

function getOAuth2AuthorizationTokenIdParam(req: Request) {
    const tokenId = req.params.token_id;
    assertOAuth2AuthorizationTokenId(tokenId);
    return tokenId;
}

export function createOAuth2AuthorizationTokenRouter() {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            responses: {
                200: {
                    body: "OAuthAuthorizationResponse",
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
            const tokenId = getOAuth2AuthorizationTokenIdParam(req);
            const authorization = await getOAuth2Authorization(tokenId, req.user_id);
            if (!authorization) throw UNKNOWN_OAUTH2_AUTHORIZATION;

            return res.json(authorization);
        },
    );

    router.delete(
        "/",
        route({
            responses: {
                204: {},
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const tokenId = getOAuth2AuthorizationTokenIdParam(req);
            const deleted = await deleteOAuth2Authorization(tokenId, req.user_id);
            if (!deleted) throw UNKNOWN_OAUTH2_AUTHORIZATION;

            return res.status(204).send();
        },
    );

    return router;
}

export default createOAuth2AuthorizationTokenRouter();
