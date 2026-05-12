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
import type { GuildScheduledEventUsersResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type UserGuildScheduledEventsListOptions = {
    guildIds: string[];
};

export interface UserGuildScheduledEventsDependencies {
    listUserGuildScheduledEventUsers(userId: string, options: UserGuildScheduledEventsListOptions): Promise<GuildScheduledEventUsersResponse>;
}

export const defaultUserGuildScheduledEventsDependencies: UserGuildScheduledEventsDependencies = {
    async listUserGuildScheduledEventUsers() {
        return [];
    },
};

const snowflakePattern = /^\d{1,20}$/;

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function parseUserGuildScheduledEventsQuery(query: Request["query"]): UserGuildScheduledEventsListOptions {
    const guildIds = [...new Set([...queryValues(query.guild_ids), ...queryValues(query["guild_ids[]"])])];

    if (!guildIds.length) throw DiscordApiErrors.INVALID_FORM_BODY;
    if (!guildIds.every((guildId) => snowflakePattern.test(guildId))) throw DiscordApiErrors.INVALID_FORM_BODY;

    return { guildIds };
}

export async function getUserGuildScheduledEvents(
    userId: string,
    options: UserGuildScheduledEventsListOptions,
    dependencies: UserGuildScheduledEventsDependencies = defaultUserGuildScheduledEventsDependencies,
): Promise<GuildScheduledEventUsersResponse> {
    return dependencies.listUserGuildScheduledEventUsers(userId, options);
}

export function createUserGuildScheduledEventsRouter(dependencies: UserGuildScheduledEventsDependencies = defaultUserGuildScheduledEventsDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get User Guild Scheduled Events",
            description:
                "Returns the current user's guild scheduled-event subscriptions for the requested guild IDs. Spacebar does not currently persist scheduled-event subscriptions, so the local representation is empty until that backing state exists.",
            query: {
                guild_ids: {
                    type: "array",
                    required: true,
                    description: "Guild IDs to get subscribed scheduled events for.",
                },
            },
            responses: {
                200: {
                    body: "GuildScheduledEventUsersResponse",
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
            const options = parseUserGuildScheduledEventsQuery(req.query);
            const scheduledEventUsers = await getUserGuildScheduledEvents(req.user_id, options, dependencies);

            return res.status(200).json(scheduledEventUsers);
        },
    );

    return router;
}

export default createUserGuildScheduledEventsRouter();
