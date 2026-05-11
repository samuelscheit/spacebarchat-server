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
import type { GuildWelcomeScreenFunnelResponse } from "@spacebar/schemas";
import { Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { parseGuildAnalyticsInsightsQuery } from "../engagement/query";

const router: Router = Router({ mergeParams: true });

export { parseGuildAnalyticsInsightsQuery as parseGuildWelcomeScreenFunnelQuery } from "../engagement/query";
export type { GuildAnalyticsAggregationInterval, GuildAnalyticsInsightsQuery as GuildWelcomeScreenFunnelQuery } from "../engagement/query";

export function createGuildWelcomeScreenFunnelResponse(): GuildWelcomeScreenFunnelResponse {
    // Spacebar does not persist Discord's welcome-screen view, click, or message funnel aggregates yet.
    return [];
}

router.get(
    "/",
    route({
        summary: "Get Guild Welcome Screen Funnel",
        description: "Returns welcome screen funnel analytics buckets for the requested aggregation interval.",
        permission: "VIEW_GUILD_INSIGHTS",
        query: {
            start: {
                type: "string",
                description: "Start date for the insights data as an ISO8601 timestamp.",
            },
            end: {
                type: "string",
                description: "End date for the insights data as an ISO8601 timestamp.",
            },
            interval: {
                type: "integer",
                description: "Aggregation interval: 0 hourly, 1 daily, 2 weekly, or 3 monthly.",
                values: ["0", "1", "2", "3"],
            },
        },
        responses: {
            200: {
                body: "GuildWelcomeScreenFunnelResponse",
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
            422: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        parseGuildAnalyticsInsightsQuery(req.query);

        const { guild_id } = req.params as { [key: string]: string };
        await Guild.findOneOrFail({
            where: { id: guild_id },
            select: { id: true },
        });

        return res.json(createGuildWelcomeScreenFunnelResponse());
    },
);

export default router;
