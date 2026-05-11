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
import type { LobbyMessagesResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Router, type Request, type Response } from "express";
import { HTTPError } from "lambert-server";
import { assertLobbyId, UNKNOWN_LOBBY } from "../../../util/utility/Lobbies";

const LOBBIES_WRITE_SCOPE = "lobbies.write";
const DEFAULT_LOBBY_MESSAGES_LIMIT = 50;
const MIN_LOBBY_MESSAGES_LIMIT = 1;
const MAX_LOBBY_MESSAGES_LIMIT = 200;

type OAuthScopeToken = {
    scope?: unknown;
    scopes?: unknown;
    scp?: unknown;
};

function scopeValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(scopeValues);
    if (typeof value !== "string") return [];

    return value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

export function hasLobbyWriteOAuthScope(token: unknown, requiredScope = LOBBIES_WRITE_SCOPE): boolean {
    if (!token || typeof token !== "object") return false;

    const scopeToken = token as OAuthScopeToken;
    return [...scopeValues(scopeToken.scope), ...scopeValues(scopeToken.scopes), ...scopeValues(scopeToken.scp)].includes(requiredScope);
}

export function assertLobbyWriteOAuthScope(token: unknown): void {
    if (!hasLobbyWriteOAuthScope(token)) throw DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE;
}

function firstQueryValue(value: unknown): unknown {
    return Array.isArray(value) ? value[0] : value;
}

export function parseLobbyMessagesLimit(query: Request["query"]): number {
    const value = firstQueryValue(query.limit);
    if (value === undefined) return DEFAULT_LOBBY_MESSAGES_LIMIT;
    if (typeof value !== "string" || !/^\d+$/.test(value.trim())) throw new HTTPError("limit must be between 1 and 200", 400);

    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < MIN_LOBBY_MESSAGES_LIMIT || limit > MAX_LOBBY_MESSAGES_LIMIT) {
        throw new HTTPError("limit must be between 1 and 200", 400);
    }

    return limit;
}

export async function getLobbyMessages(lobbyId: string, userId: string, limit: number): Promise<LobbyMessagesResponse | null> {
    assertLobbyId(lobbyId);
    void userId;
    void limit;

    // Spacebar does not currently persist Discord Social SDK lobbies or lobby message history.
    return null;
}

export async function getLobbyMessagesForRequest(lobbyId: string, userId: string, token: unknown, query: Request["query"]): Promise<LobbyMessagesResponse> {
    assertLobbyWriteOAuthScope(token);
    assertLobbyId(lobbyId);

    const limit = parseLobbyMessagesLimit(query);
    const messages = await getLobbyMessages(lobbyId, userId, limit);
    if (!messages) throw UNKNOWN_LOBBY;

    return messages;
}

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        summary: "Get Lobby Messages",
        query: {
            limit: {
                type: "number",
                description: "Max number of messages to return (1-200, default 50)",
            },
        },
        responses: {
            200: {
                body: "LobbyMessagesResponse",
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
        const { lobby_id } = req.params as { lobby_id: string };
        const messages = await getLobbyMessagesForRequest(lobby_id, req.user_id, req.token, req.query);
        return res.status(200).json(messages);
    },
);

export default router;
