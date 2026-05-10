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
import type { GamesResponse } from "@spacebar/schemas";
import { Application, FieldErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { In } from "typeorm";
import { serializeApplicationGame, shouldIncludeGameSupplementalData, type GameApplication } from "../../util/utility/GameResponse";

const router: Router = Router({ mergeParams: true });

const gameIdPattern = /^\d{1,20}$/;

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function parseGameIdsQuery(query: Request["query"]): string[] {
    const gameIds = [...queryValues(query.game_ids), ...queryValues(query["game_ids[]"])];

    if (!gameIds.length) {
        throw FieldErrors({
            game_ids: {
                code: "BASE_TYPE_REQUIRED",
                message: "game_ids is required",
            },
        });
    }

    if (gameIds.length > 25) {
        throw FieldErrors({
            game_ids: {
                code: "BASE_TYPE_BAD_LENGTH",
                message: "game_ids must contain between 1 and 25 values",
            },
        });
    }

    if (gameIds.some((gameId) => !gameIdPattern.test(gameId))) {
        throw FieldErrors({
            game_ids: {
                code: "BASE_TYPE_INVALID",
                message: "game_ids must contain valid snowflakes",
            },
        });
    }

    return [...new Set(gameIds)];
}

const gameApplicationSelect = {
    id: true,
    name: true,
    icon: true,
    cover_image: true,
    summary: true,
    hook: true,
    announcements_channel_id: true,
};

router.get(
    "/",
    route({
        summary: "Get Games",
        query: {
            game_ids: {
                type: "array",
                required: true,
                description: "Application IDs to get games for (1-25).",
            },
            with_supplemental_data: {
                type: "boolean",
                description: "Whether to include supplemental game data (default true).",
            },
        },
        responses: {
            200: {
                body: "GamesResponse",
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
        const gameIds = parseGameIdsQuery(req.query);
        const includeSupplementalData = shouldIncludeGameSupplementalData(req.query.with_supplemental_data);
        const applications = await Application.find({
            where: {
                id: In(gameIds),
            },
            select: gameApplicationSelect,
        });
        const applicationsById = new Map(applications.map((application) => [application.id, application as GameApplication]));
        const response: GamesResponse = gameIds.flatMap((gameId) => {
            const application = applicationsById.get(gameId);
            return application ? [serializeApplicationGame(application, includeSupplementalData)] : [];
        });

        return res.json(response);
    },
);

export default router;
