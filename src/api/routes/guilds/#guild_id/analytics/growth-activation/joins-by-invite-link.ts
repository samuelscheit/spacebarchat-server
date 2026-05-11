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
import type { GuildGrowthActivationJoinsByInviteLinkResponse } from "@spacebar/schemas";
import { Guild } from "@spacebar/util";
import { type Request, type Response, Router } from "express";
import { parseGuildGrowthActivationAnalyticsQuery } from "./query";

const router: Router = Router({ mergeParams: true });

export { parseGuildGrowthActivationAnalyticsQuery as parseGuildGrowthActivationJoinsByInviteLinkQuery } from "./query";
export type { GuildAnalyticsAggregationInterval, GuildGrowthActivationAnalyticsQuery as GuildGrowthActivationJoinsByInviteLinkQuery } from "./query";

export function createGuildGrowthActivationJoinsByInviteLinkResponse(): GuildGrowthActivationJoinsByInviteLinkResponse {
    // Spacebar does not persist Discord's per-invite guild growth analytics buckets yet.
    return [];
}

router.get(
    "/",
    route({
        summary: "Get Guild Growth Activation Joins by Invite",
        description: "Returns member join counts by invite link per aggregation interval.",
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
                body: "GuildGrowthActivationJoinsByInviteLinkResponse",
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
        parseGuildGrowthActivationAnalyticsQuery(req.query);

        const { guild_id } = req.params as { [key: string]: string };
        await Guild.findOneOrFail({
            where: { id: guild_id },
            select: { id: true },
        });

        return res.json(createGuildGrowthActivationJoinsByInviteLinkResponse());
    },
);

export default router;
