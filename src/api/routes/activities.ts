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

import { randomUUID } from "node:crypto";
import { route } from "@spacebar/api";
import type { ActivitySessionUpdateResponse, ActivitySessionUpdateSchema, GlobalActivityStatisticsResponse } from "@spacebar/schemas";
import { type Request, type Response, Router } from "express";

export interface GlobalActivityStatisticsContext {
    userId: string;
    withUsers: boolean;
    withApplications: boolean;
}

export type ActivitySessionTokenFactory = () => string;

export interface ActivitiesRouterOptions {
    activitySessionTokenFactory?: ActivitySessionTokenFactory;
}

function defaultActivitySessionTokenFactory() {
    return `spacebar-activity-session.${randomUUID()}`;
}

function queryBoolean(value: unknown) {
    return value === true || value === "true";
}

export function getGlobalActivityStatisticsResponse(_context: GlobalActivityStatisticsContext): GlobalActivityStatisticsResponse {
    // Spacebar does not persist durable friend or affine-user activity statistics yet.
    return [];
}

export function updateActivitySession(
    body: ActivitySessionUpdateSchema,
    tokenFactory: ActivitySessionTokenFactory = defaultActivitySessionTokenFactory,
): ActivitySessionUpdateResponse {
    const token = body.token?.trim();

    return {
        token: token || tokenFactory(),
    };
}

export function createActivitiesRouter(options: ActivitiesRouterOptions = {}) {
    const router: Router = Router({ mergeParams: true });
    const tokenFactory = options.activitySessionTokenFactory ?? defaultActivitySessionTokenFactory;

    router.get(
        "/",
        route({
            summary: "Get Global Activity Statistics",
            description:
                "Returns recent activity statistics for friends and affine users. Spacebar does not currently persist durable source-backed global activity statistics, so this compatibility endpoint returns an empty statistics list.",
            query: {
                with_users: {
                    type: "boolean",
                    required: false,
                    description: "Whether to include user information in the returned activity statistics.",
                },
                with_applications: {
                    type: "boolean",
                    required: false,
                    description: "Whether to include application information in the returned activity statistics.",
                },
            },
            responses: {
                200: {
                    body: "GlobalActivityStatisticsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            const body = getGlobalActivityStatisticsResponse({
                userId: req.user_id,
                withUsers: queryBoolean(req.query.with_users),
                withApplications: queryBoolean(req.query.with_applications),
            });

            return res.status(200).json(body);
        },
    );

    router.post(
        "/",
        route({
            summary: "Update Activity Session",
            description:
                "Validates a client activity session update and returns the existing or generated session token. Spacebar does not currently persist game playtime statistics from this endpoint.",
            requestBody: "ActivitySessionUpdateSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "ActivitySessionUpdateResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => res.status(200).json(updateActivitySession(req.body as ActivitySessionUpdateSchema, tokenFactory)),
    );

    return router;
}

export default createActivitiesRouter();
