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
import type { GuildTopGamesResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export function buildGuildTopGamesResponse(): GuildTopGamesResponse {
    // Spacebar does not currently persist source-backed guild playtime rankings.
    return { top_games: [] };
}

export function createGuildTopGamesRouter() {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Top Games",
            description: "Returns up to 20 of the top most played games for the guild. Requires the MANAGE_GUILD permission.",
            permission: "MANAGE_GUILD",
            responses: {
                200: {
                    body: "GuildTopGamesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (_req: Request, res: Response) => res.status(200).json(buildGuildTopGamesResponse()),
    );

    return router;
}

export default createGuildTopGamesRouter();
