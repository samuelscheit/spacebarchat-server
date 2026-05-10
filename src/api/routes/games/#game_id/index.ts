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
import { Application, DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { serializeApplicationGame, shouldIncludeGameSupplementalData, type GameApplication } from "../../../util/utility/GameResponse";

const router: Router = Router({ mergeParams: true });

export { serializeApplicationGame, shouldIncludeGameSupplementalData, type GameApplication } from "../../../util/utility/GameResponse";

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
