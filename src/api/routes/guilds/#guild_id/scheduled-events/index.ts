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

import { assertGuildMember, route } from "@spacebar/api";
import type { GuildScheduledEventUserCountResponse, GuildScheduledEventsResponse } from "@spacebar/schemas";
import { DiscordApiErrors, Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type GuildScheduledEventsListOptions = {
    withUserCount: boolean;
};

export type GuildScheduledEventUserCountOptions = {
    guildScheduledEventExceptionIds: string[];
};

export interface GuildScheduledEventsDependencies {
    assertGuildExists(guildId: string): Promise<void>;
    assertRequesterGuildMember(userId: string | undefined, guildId: string): Promise<void>;
    listGuildScheduledEvents(guildId: string, options: GuildScheduledEventsListOptions): Promise<GuildScheduledEventsResponse>;
    countGuildScheduledEventUsers(guildId: string, guildScheduledEventId: string, options: GuildScheduledEventUserCountOptions): Promise<GuildScheduledEventUserCountResponse>;
}

export const defaultGuildScheduledEventsDependencies: GuildScheduledEventsDependencies = {
    async assertGuildExists(guildId) {
        await Guild.findOneOrFail({
            where: { id: guildId },
            select: { id: true },
        });
    },
    assertRequesterGuildMember: assertGuildMember,
    async listGuildScheduledEvents() {
        return [];
    },
    async countGuildScheduledEventUsers(_guildId, _guildScheduledEventId, options) {
        return getEmptyGuildScheduledEventUserCount(options.guildScheduledEventExceptionIds);
    },
};

const snowflakePattern = /^\d{1,20}$/;

function queryValues(value: unknown): string[] {
    if (value === undefined) return [];
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") throw DiscordApiErrors.INVALID_FORM_BODY;

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function parseWithUserCount(value: unknown): boolean {
    if (Array.isArray(value)) return parseWithUserCount(value[0]);
    return value === true || value === "true" || value === "1";
}

export function parseGuildScheduledEventUserCountsQuery(query: Request["query"]): GuildScheduledEventUserCountOptions {
    const guildScheduledEventExceptionIds = [
        ...new Set([...queryValues(query.guild_scheduled_event_exception_ids), ...queryValues(query["guild_scheduled_event_exception_ids[]"])]),
    ];

    if (guildScheduledEventExceptionIds.length > 10) throw DiscordApiErrors.INVALID_FORM_BODY;
    if (guildScheduledEventExceptionIds.some((guildScheduledEventExceptionId) => !snowflakePattern.test(guildScheduledEventExceptionId))) {
        throw DiscordApiErrors.INVALID_FORM_BODY;
    }

    return { guildScheduledEventExceptionIds };
}

export function getEmptyGuildScheduledEventUserCount(guildScheduledEventExceptionIds: string[] = []): GuildScheduledEventUserCountResponse {
    const guildScheduledEventExceptionCounts = Object.fromEntries(guildScheduledEventExceptionIds.map((guildScheduledEventExceptionId) => [guildScheduledEventExceptionId, 0]));

    return {
        guild_scheduled_event_count: 0,
        guild_scheduled_event_exception_counts: guildScheduledEventExceptionCounts,
    };
}

export async function getGuildScheduledEvents(
    requesterId: string | undefined,
    guildId: string,
    options: GuildScheduledEventsListOptions,
    dependencies: GuildScheduledEventsDependencies = defaultGuildScheduledEventsDependencies,
): Promise<GuildScheduledEventsResponse> {
    await dependencies.assertGuildExists(guildId);
    await dependencies.assertRequesterGuildMember(requesterId, guildId);

    return dependencies.listGuildScheduledEvents(guildId, options);
}

export async function getGuildScheduledEventUserCount(
    requesterId: string | undefined,
    guildId: string,
    guildScheduledEventId: string,
    options: GuildScheduledEventUserCountOptions,
    dependencies: GuildScheduledEventsDependencies = defaultGuildScheduledEventsDependencies,
): Promise<GuildScheduledEventUserCountResponse> {
    await dependencies.assertGuildExists(guildId);
    await dependencies.assertRequesterGuildMember(requesterId, guildId);

    return dependencies.countGuildScheduledEventUsers(guildId, guildScheduledEventId, options);
}

export function createGuildScheduledEventsRouter(dependencies: GuildScheduledEventsDependencies = defaultGuildScheduledEventsDependencies) {
    const router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Guild Scheduled Events",
            description: "Returns scheduled and active guild scheduled events visible to the current guild member.",
            query: {
                with_user_count: {
                    type: "boolean",
                    description: "Whether to include subscriber counts for each scheduled event.",
                },
            },
            responses: {
                200: {
                    body: "GuildScheduledEventsResponse",
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
        async (req: Request, res: Response) => {
            const { guild_id } = req.params as { guild_id: string };
            const withUserCount = parseWithUserCount(req.query.with_user_count);
            const scheduledEvents = await getGuildScheduledEvents(req.user_id, guild_id, { withUserCount }, dependencies);

            return res.status(200).json(scheduledEvents);
        },
    );

    router.get(
        "/:guild_scheduled_event_id/users/counts",
        route({
            summary: "Get Guild Scheduled Event User Count",
            description:
                "Returns locally persisted subscriber counts for a guild scheduled event. Spacebar does not currently persist scheduled-event subscriptions, so counts are zero until that backing state exists.",
            query: {
                guild_scheduled_event_exception_ids: {
                    type: "array",
                    description: "Exception IDs to return subscriber counts for (max 10).",
                },
            },
            responses: {
                200: {
                    body: "GuildScheduledEventUserCountResponse",
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
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { guild_id, guild_scheduled_event_id } = req.params as {
                guild_id: string;
                guild_scheduled_event_id: string;
            };
            const options = parseGuildScheduledEventUserCountsQuery(req.query);
            const counts = await getGuildScheduledEventUserCount(req.user_id, guild_id, guild_scheduled_event_id, options, dependencies);

            return res.status(200).json(counts);
        },
    );

    return router;
}

export default createGuildScheduledEventsRouter();
