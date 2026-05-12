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
import type { GuildMemberUnusualDmActivityResponse } from "@spacebar/schemas";
import { Member } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router({ mergeParams: true });
const DEFAULT_UNUSUAL_DM_ACTIVITY_LIMIT = 100;
const MAX_UNUSUAL_DM_ACTIVITY_LIMIT = 1000;
const snowflakePattern = /^\d{1,20}$/;

export interface GuildMemberUnusualDmActivityQuery {
    after?: string;
    limit: number;
}

function getSingleQueryValue(query: Request["query"], key: "after" | "limit") {
    const value = query[key];
    if (value == undefined) return undefined;
    if (Array.isArray(value)) throw new HTTPError(`${key} may only be specified once`, 400);
    if (typeof value !== "string") throw new HTTPError(`${key} must be a string`, 400);
    if (!value) throw new HTTPError(`${key} must not be empty`, 400);

    return value;
}

function parseLimit(value: string | undefined) {
    if (value == undefined) return DEFAULT_UNUSUAL_DM_ACTIVITY_LIMIT;
    if (!/^\d+$/.test(value)) throw new HTTPError("limit must be an integer between 1 and 1000", 400);

    const limit = Number(value);
    if (limit < 1 || limit > MAX_UNUSUAL_DM_ACTIVITY_LIMIT) throw new HTTPError("limit must be an integer between 1 and 1000", 400);

    return limit;
}

export function parseGuildMemberUnusualDmActivityQuery(query: Request["query"]): GuildMemberUnusualDmActivityQuery {
    const after = getSingleQueryValue(query, "after");
    if (after != undefined && !snowflakePattern.test(after)) throw new HTTPError("after must be a snowflake", 400);

    const parsed: GuildMemberUnusualDmActivityQuery = {
        limit: parseLimit(getSingleQueryValue(query, "limit")),
    };
    if (after != undefined) parsed.after = after;

    return parsed;
}

export function getGuildMembersWithUnusualDmActivity(): GuildMemberUnusualDmActivityResponse {
    // Spacebar does not persist Discord's unusual-DM activity safety signal yet.
    return [];
}

router.get(
    "/",
    route({
        summary: "Get Guild Members With Unusual DM Activity",
        description: "Returns members with persisted unusual-DM activity. Spacebar does not currently persist this safety signal, so the local representation is empty.",
        query: {
            limit: {
                type: "integer",
                description: "Max number of members to return (max 1000, default 100).",
            },
            after: {
                type: "string",
                description: "Get members after this member ID.",
            },
        },
        responses: {
            200: {
                body: "GuildMemberUnusualDmActivityResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        parseGuildMemberUnusualDmActivityQuery(req.query);

        const { guild_id } = req.params as { [key: string]: string };
        await Member.IsInGuildOrFail(req.user_id, guild_id);

        return res.json(getGuildMembersWithUnusualDmActivity());
    },
);

export default router;
