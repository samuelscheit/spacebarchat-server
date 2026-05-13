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
import type { SafetyHubClassificationReviewResponse, SafetyHubSuspendedClassificationReviewSchema } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

const routeSnowflakePattern = /^\d{1,20}$/;

export const SAFETY_HUB_SUSPENDED_CLASSIFICATION_REVIEW_UNSUPPORTED_MESSAGE =
    "Safety Hub suspended-user classification review requests are not supported on this Spacebar instance.";
export const UNKNOWN_SAFETY_HUB_CLASSIFICATION = new ApiError("Unknown safety hub classification", 0, 404);

export interface SafetyHubSuspendedClassificationReviewRequest {
    classification_id: string;
    token: string;
    signal: SafetyHubSuspendedClassificationReviewSchema["signal"];
    user_input: string;
    ip?: string;
    userAgent?: string;
}

export interface SafetyHubSuspendedClassificationReviewDependencies {
    requestReview(request: SafetyHubSuspendedClassificationReviewRequest): Promise<SafetyHubClassificationReviewResponse>;
}

export function isSafetyHubClassificationId(value: string): boolean {
    return routeSnowflakePattern.test(value);
}

export function createSafetyHubSuspendedClassificationReviewUnsupportedError(): ApiError {
    return new ApiError(SAFETY_HUB_SUSPENDED_CLASSIFICATION_REVIEW_UNSUPPORTED_MESSAGE, 0, 501);
}

function getClassificationId(req: Request): string {
    const value = req.params.classification_id;
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const defaultSafetyHubSuspendedClassificationReviewDependencies: SafetyHubSuspendedClassificationReviewDependencies = {
    async requestReview() {
        // A successful implementation needs a real suspended-user token verifier
        // and durable Trust & Safety appeal state. Without those, do not mint
        // local appeal IDs from client input.
        throw createSafetyHubSuspendedClassificationReviewUnsupportedError();
    },
};

function buildSafetyHubSuspendedClassificationReviewRequest(req: Request, body: SafetyHubSuspendedClassificationReviewSchema): SafetyHubSuspendedClassificationReviewRequest {
    return {
        classification_id: getClassificationId(req),
        token: body.token,
        signal: body.signal,
        user_input: body.user_input,
        ip: req.ip,
        userAgent: req.get("user-agent"),
    };
}

export function createSafetyHubSuspendedClassificationReviewRouter(
    dependencies: SafetyHubSuspendedClassificationReviewDependencies = defaultSafetyHubSuspendedClassificationReviewDependencies,
) {
    const router: Router = Router({ mergeParams: true });

    router.put(
        "/",
        route({
            summary: "Request Classification Review for Suspended User",
            description:
                "Requests a Safety Hub classification review for a suspended user when a real suspended-user token verifier and durable appeal store are configured. The default Spacebar instance has no local Trust & Safety appeal provider, so this compatibility endpoint validates the request and fails closed with 501 instead of fabricating appeal state.",
            requestBody: "SafetyHubSuspendedClassificationReviewSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "SafetyHubClassificationReviewResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
            spacebarOnly: false,
        }),
        async (req: Request, res: Response) => {
            if (!isSafetyHubClassificationId(getClassificationId(req))) throw UNKNOWN_SAFETY_HUB_CLASSIFICATION;

            const body = req.body as SafetyHubSuspendedClassificationReviewSchema;
            const response = await dependencies.requestReview(buildSafetyHubSuspendedClassificationReviewRequest(req, body));

            return res.json(response);
        },
    );

    return router;
}

export default createSafetyHubSuspendedClassificationReviewRouter();
