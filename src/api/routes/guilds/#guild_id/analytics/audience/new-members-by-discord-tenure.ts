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
import type { GuildAudienceNewMembersByDiscordTenureResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export function getGuildAudienceNewMembersByDiscordTenure(): GuildAudienceNewMembersByDiscordTenureResponse {
    // Spacebar does not persist Discord's guild analytics visitor, opt-out, or privacy-threshold aggregates yet.
    return [];
}

router.get(
    "/",
    route({
        summary: "Get Guild Audience New Members by Discord Tenure",
        description: "Returns new member statistics categorized by account age per aggregation interval.",
        permission: "VIEW_GUILD_INSIGHTS",
        query: {
            start: {
                type: "string",
                description: "ISO8601 start timestamp for the insights data",
            },
            end: {
                type: "string",
                description: "ISO8601 end timestamp for the insights data",
            },
            interval: {
                type: "integer",
                description: "Data aggregation interval: 0 hourly, 1 daily, 2 weekly, or 3 monthly",
            },
        },
        responses: {
            200: {
                body: "GuildAudienceNewMembersByDiscordTenureResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    (_req: Request, res: Response) => res.status(200).json(getGuildAudienceNewMembersByDiscordTenure()),
);

export default router;
