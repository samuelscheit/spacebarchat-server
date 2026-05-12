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
import type { GuildScheduledEventsResponse } from "@spacebar/schemas";
import { Guild } from "@spacebar/util";
import { Request, Response, Router } from "express";

export type GuildScheduledEventsListOptions = {
    withUserCount: boolean;
};

export interface GuildScheduledEventsDependencies {
    assertGuildExists(guildId: string): Promise<void>;
    assertRequesterGuildMember(userId: string | undefined, guildId: string): Promise<void>;
    listGuildScheduledEvents(guildId: string, options: GuildScheduledEventsListOptions): Promise<GuildScheduledEventsResponse>;
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
};

export function parseWithUserCount(value: unknown): boolean {
    if (Array.isArray(value)) return parseWithUserCount(value[0]);
    return value === true || value === "true" || value === "1";
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

    return router;
}

export default createGuildScheduledEventsRouter();
