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
import type { NotificationCenterItemsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

export const NOTIFICATION_CENTER_ITEMS_DEFAULT_LIMIT = 25;
export const NOTIFICATION_CENTER_ITEMS_MIN_LIMIT = 1;
export const NOTIFICATION_CENTER_ITEMS_MAX_LIMIT = 100;

export interface NotificationCenterItemsQueryOptions {
    after?: string;
    with_mentions: boolean;
    roles_filter: boolean;
    everyone_filter: boolean;
    limit: number;
}

function firstQueryValue(value: unknown): string | number | boolean | undefined {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    return undefined;
}

export function parseNotificationCenterItemsLimit(value: unknown): number {
    const scalar = firstQueryValue(value);
    if (scalar === undefined) return NOTIFICATION_CENTER_ITEMS_DEFAULT_LIMIT;

    const raw = String(scalar).trim();
    if (!raw) return NOTIFICATION_CENTER_ITEMS_DEFAULT_LIMIT;

    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) return NOTIFICATION_CENTER_ITEMS_DEFAULT_LIMIT;

    return Math.min(NOTIFICATION_CENTER_ITEMS_MAX_LIMIT, Math.max(NOTIFICATION_CENTER_ITEMS_MIN_LIMIT, parsed));
}

export function parseNotificationCenterItemsBoolean(value: unknown, fallback: boolean): boolean {
    const scalar = firstQueryValue(value);
    if (scalar === undefined) return fallback;
    if (typeof scalar === "boolean") return scalar;

    const normalized = String(scalar).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;

    return fallback;
}

export function parseNotificationCenterItemsQuery(query: Request["query"]): NotificationCenterItemsQueryOptions {
    const after = firstQueryValue(query.after);

    return {
        after: typeof after === "string" && after ? after : undefined,
        with_mentions: parseNotificationCenterItemsBoolean(query.with_mentions, false),
        roles_filter: parseNotificationCenterItemsBoolean(query.roles_filter, true),
        everyone_filter: parseNotificationCenterItemsBoolean(query.everyone_filter, true),
        limit: parseNotificationCenterItemsLimit(query.limit),
    };
}

export function buildNotificationCenterItemsResponse(options: NotificationCenterItemsQueryOptions): NotificationCenterItemsResponse {
    void options.after;
    void options.with_mentions;
    void options.roles_filter;
    void options.everyone_filter;

    // Spacebar does not persist Discord notification-center item records yet.
    // Return a typed empty page instead of fabricating item IDs that ack/delete routes would not own.
    return {
        limit: options.limit,
        items: [],
        cursor: null,
        has_more: false,
    };
}

router.get(
    "/",
    route({
        summary: "Get Notification Center Items",
        query: {
            after: {
                type: "string",
                description: "Get notification center items after this notification center item ID.",
            },
            with_mentions: {
                type: "boolean",
                description: "Whether to include recent mention notifications.",
            },
            roles_filter: {
                type: "boolean",
                description: "Whether to include role mentions.",
            },
            everyone_filter: {
                type: "boolean",
                description: "Whether to include @everyone and @here mentions.",
            },
            limit: {
                type: "integer",
                description: "Max number of notification center items to return, from 1 to 100.",
            },
        },
        responses: {
            200: {
                body: "NotificationCenterItemsResponse",
            },
            401: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const query = parseNotificationCenterItemsQuery(req.query);
        const response = buildNotificationCenterItemsResponse(query);

        return res.json(response);
    },
);

export default router;
