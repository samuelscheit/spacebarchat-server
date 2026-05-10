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
import type { CheckpointResponse } from "@spacebar/schemas";
import { Member, Message } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { Between } from "typeorm";

export interface CheckpointYearRange {
    start: Date;
    end: Date;
}

export interface CheckpointStatisticsProvider {
    now: () => Date;
    countMessagesSent: (userId: string, range: CheckpointYearRange) => Promise<number>;
    countGuildsJoined: (userId: string, range: CheckpointYearRange) => Promise<number>;
}

export function getCheckpointYearRange(now: Date): CheckpointYearRange {
    return {
        start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0)),
        end: now,
    };
}

export const defaultCheckpointStatisticsProvider: CheckpointStatisticsProvider = {
    now: () => new Date(),
    countMessagesSent: (userId, range) =>
        Message.count({
            where: {
                author_id: userId,
                timestamp: Between(range.start, range.end),
            },
        }),
    countGuildsJoined: (userId, range) =>
        Member.count({
            where: {
                id: userId,
                joined_at: Between(range.start, range.end),
            },
        }),
};

export async function buildCheckpointResponse(userId: string, statisticsProvider: CheckpointStatisticsProvider = defaultCheckpointStatisticsProvider): Promise<CheckpointResponse> {
    const range = getCheckpointYearRange(statisticsProvider.now());
    const [numMessagesSent, numGuildsJoined] = await Promise.all([statisticsProvider.countMessagesSent(userId, range), statisticsProvider.countGuildsJoined(userId, range)]);

    return {
        avatar_decoration: null,
        messages: {
            num_messages_sent: numMessagesSent,
            num_messages_sent_percentile: null,
            top_month: null,
        },
        guilds: {
            num_guilds_joined: numGuildsJoined,
            guilds: [],
        },
        users: [],
    };
}

export function createCheckpointRouter(statisticsProvider: CheckpointStatisticsProvider = defaultCheckpointStatisticsProvider) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Checkpoint",
            responses: {
                200: {
                    body: "CheckpointResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            res.status(200).json(await buildCheckpointResponse(req.user_id, statisticsProvider));
        },
    );

    return router;
}

export default createCheckpointRouter();
