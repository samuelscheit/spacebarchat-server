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

import type { Request } from "express";
import { HTTPError } from "lambert-server";

const SUPPORTED_INTERVALS = new Set([0, 1, 2, 3]);

export type GuildAnalyticsAggregationInterval = 0 | 1 | 2 | 3;

export interface GuildAnalyticsInsightsQuery {
    start?: Date;
    end?: Date;
    interval?: GuildAnalyticsAggregationInterval;
}

function getSingleQueryValue(query: Request["query"], key: string) {
    const value = query[key];
    if (value == undefined) return undefined;
    if (Array.isArray(value)) throw new HTTPError(`${key} may only be specified once`, 422);
    if (typeof value !== "string") throw new HTTPError(`${key} must be a string`, 422);
    if (!value) throw new HTTPError(`${key} must not be empty`, 422);

    return value;
}

function parseOptionalIso8601Timestamp(query: Request["query"], key: "start" | "end") {
    const value = getSingleQueryValue(query, key);
    if (value == undefined) return undefined;

    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) throw new HTTPError(`${key} must be an ISO8601 timestamp`, 422);

    return new Date(timestamp);
}

function parseOptionalAggregationInterval(query: Request["query"]) {
    const value = getSingleQueryValue(query, "interval");
    if (value == undefined) return undefined;

    if (!/^\d+$/.test(value)) throw new HTTPError("interval must be one of 0, 1, 2, or 3", 422);

    const interval = Number(value);
    if (!SUPPORTED_INTERVALS.has(interval)) throw new HTTPError("interval must be one of 0, 1, 2, or 3", 422);

    return interval as GuildAnalyticsAggregationInterval;
}

export function parseGuildAnalyticsInsightsQuery(query: Request["query"]): GuildAnalyticsInsightsQuery {
    const parsed = {
        start: parseOptionalIso8601Timestamp(query, "start"),
        end: parseOptionalIso8601Timestamp(query, "end"),
        interval: parseOptionalAggregationInterval(query),
    };

    if (parsed.start && parsed.end && parsed.start > parsed.end) throw new HTTPError("start must be before or equal to end", 422);

    return parsed;
}
