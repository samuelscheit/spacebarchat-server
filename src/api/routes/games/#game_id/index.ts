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
import type { GameResponse, GameSupplementalData } from "@spacebar/schemas";
import { Application, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export type GameApplication = Pick<Application, "id" | "name" | "icon" | "cover_image" | "summary" | "hook" | "announcements_channel_id">;

export function shouldIncludeGameSupplementalData(value: unknown): boolean {
    if (Array.isArray(value)) return shouldIncludeGameSupplementalData(value[0]);
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return true;

    return value.toLowerCase() !== "false";
}

function nonEmptyString(value: string | null | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function createGameSupplementalData(application: GameApplication): GameSupplementalData {
    const supplemental: GameSupplementalData = {
        application_id: application.id,
        name: application.name,
    };
    const summary = nonEmptyString(application.summary);

    if (summary) supplemental.summary = summary;
    if (application.icon !== undefined) supplemental.icon_hash = application.icon ?? null;
    if (application.announcements_channel_id) supplemental.announcements_channel_id = application.announcements_channel_id;

    return supplemental;
}

export function serializeApplicationGame(application: GameApplication, includeSupplementalData = true): GameResponse {
    const response: GameResponse = {
        id: application.id,
        name: application.name,
        icon_hash: application.icon ?? null,
        cover_image_hash: application.cover_image ?? null,
        aliases: [],
        executables: [],
        themes: [],
        hook: application.hook ?? true,
        overlay: false,
        overlay_methods: null,
        overlay_warn: false,
        overlay_compatibility_hook: false,
        companies: [],
    };

    if (includeSupplementalData) response.supplemental_game_data = createGameSupplementalData(application);

    return response;
}

router.get(
    "/",
    route({
        summary: "Get Game",
        query: {
            with_supplemental_data: {
                type: "boolean",
                description: "Whether to include supplemental game data (default true).",
            },
        },
        responses: {
            200: {
                body: "GameResponse",
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
        const { game_id } = req.params as { game_id: string };
        const application = await Application.findOne({
            where: { id: game_id },
            select: {
                id: true,
                name: true,
                icon: true,
                cover_image: true,
                summary: true,
                hook: true,
                announcements_channel_id: true,
            },
        });

        if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;

        const includeSupplementalData = shouldIncludeGameSupplementalData(req.query.with_supplemental_data);
        return res.json(serializeApplicationGame(application, includeSupplementalData));
    },
);

export default router;
