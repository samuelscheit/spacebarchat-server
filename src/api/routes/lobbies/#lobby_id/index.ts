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
import type { LobbyResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const lobbyIdPattern = /^[1-9]\d{16,19}$/;

export const UNKNOWN_LOBBY = new ApiError(DiscordApiErrors.UNKNOWN_LOBBY.message, DiscordApiErrors.UNKNOWN_LOBBY.code, 404);

export function isLobbyId(value: unknown): value is string {
    return typeof value === "string" && lobbyIdPattern.test(value);
}

export function assertLobbyId(value: unknown): asserts value is string {
    if (!isLobbyId(value)) throw UNKNOWN_LOBBY;
}

export async function getLobby(lobbyId: string, userId: string): Promise<LobbyResponse | null> {
    assertLobbyId(lobbyId);
    void userId;

    // Spacebar does not currently persist Discord Social SDK lobbies or members.
    return null;
}

export async function getLobbyForRequest(lobbyId: string, userId: string, userIsBot: boolean): Promise<LobbyResponse> {
    if (!userIsBot) throw DiscordApiErrors.BOT_ONLY_ENDPOINT;

    const lobby = await getLobby(lobbyId, userId);
    if (!lobby) throw UNKNOWN_LOBBY;

    return lobby;
}

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        summary: "Get Lobby",
        responses: {
            200: {
                body: "LobbyResponse",
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
        const lobby = await getLobbyForRequest(lobby_id, req.user_id, req.user_bot);
        return res.status(200).json(lobby);
    },
);

export default router;
