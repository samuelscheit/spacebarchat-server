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
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const XBOX_GAME_INVITE_APPLICATION_ID = "622174530214821906";
export const GAME_INVITES_UNSUPPORTED_MESSAGE = "Game invites are not supported on this Spacebar instance.";

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

export function getGameInviteApplicationId(token: unknown): string | undefined {
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

export function assertXboxGameInviteOAuthToken(token: unknown): void {
    if (getGameInviteApplicationId(token) !== XBOX_GAME_INVITE_APPLICATION_ID) throw DiscordApiErrors.INVALID_OAUTH_TOKEN;
}

export function createGameInvitesUnsupportedError(): ApiError {
    return new ApiError(GAME_INVITES_UNSUPPORTED_MESSAGE, 0, 501);
}

function throwUnsupportedGameInvite(token: unknown): never {
    assertXboxGameInviteOAuthToken(token);

    // Discord documents game invites as Xbox-integration-only and success emits
    // game-invite gateway events. Spacebar has no durable game-invite state or
    // gateway event model, so fail closed instead of fabricating invites.
    throw createGameInvitesUnsupportedError();
}

router.delete(
    "/",
    route({
        summary: "Delete Game Invites",
        responses: {
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
    (req: Request, _res: Response) => {
        throwUnsupportedGameInvite(req.token);
    },
);

router.post(
    "/",
    route({
        summary: "Create Game Invite",
        requestBody: "GameInviteCreateSchema",
        responses: {
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
    (req: Request, _res: Response) => {
        throwUnsupportedGameInvite(req.token);
    },
);

export default router;
