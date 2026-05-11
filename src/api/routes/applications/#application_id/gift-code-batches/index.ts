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
import type { ApplicationGiftCodeBatchResponse, ApplicationGiftCodeBatchesResponse } from "@spacebar/schemas";
import { GiftCodeBatch } from "@spacebar/util";
import { type Request, type Response, Router } from "express";
import { requireApplicationGiftCodeBatchAccess, type ApplicationCommandAuthorizationRepository } from "../../../../util/utility/ApplicationAuthorization";

export type ApplicationGiftCodeBatchSource = {
    id: string;
    sku_id: string;
    amount: number;
    description?: string | null;
    entitlement_branches?: string[] | null;
    entitlement_starts_at?: Date | string | null;
    entitlement_ends_at?: Date | string | null;
};

export type ApplicationGiftCodeBatchRepository = {
    find(options: unknown): Promise<ApplicationGiftCodeBatchSource[]>;
};

export type ApplicationGiftCodeBatchRepositories = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    batchRepository?: ApplicationGiftCodeBatchRepository;
};

function getGiftCodeBatchRepository(repository?: ApplicationGiftCodeBatchRepository): ApplicationGiftCodeBatchRepository {
    return (repository ?? {
        find: (options: unknown) => GiftCodeBatch.find(options as Parameters<typeof GiftCodeBatch.find>[0]) as unknown as Promise<ApplicationGiftCodeBatchSource[]>,
    }) as ApplicationGiftCodeBatchRepository;
}

function serializeTimestamp(value: Date | string | null | undefined) {
    if (value == null) return undefined;
    return value instanceof Date ? value.toISOString() : value;
}

export function serializeApplicationGiftCodeBatch(batch: ApplicationGiftCodeBatchSource): ApplicationGiftCodeBatchResponse {
    const response: ApplicationGiftCodeBatchResponse = {
        id: batch.id,
        sku_id: batch.sku_id,
        amount: batch.amount,
    };

    if (batch.description != null) response.description = batch.description;
    if (batch.entitlement_branches != null) response.entitlement_branches = batch.entitlement_branches;

    const entitlementStartsAt = serializeTimestamp(batch.entitlement_starts_at);
    if (entitlementStartsAt != undefined) response.entitlement_starts_at = entitlementStartsAt;

    const entitlementEndsAt = serializeTimestamp(batch.entitlement_ends_at);
    if (entitlementEndsAt != undefined) response.entitlement_ends_at = entitlementEndsAt;

    return response;
}

export async function getApplicationGiftCodeBatches(
    applicationId: string,
    userId: string,
    repositories: ApplicationGiftCodeBatchRepositories = {},
): Promise<ApplicationGiftCodeBatchesResponse> {
    await requireApplicationGiftCodeBatchAccess(applicationId, userId, repositories.applicationRepository);

    const batchRepository = getGiftCodeBatchRepository(repositories.batchRepository);
    const batches = await batchRepository.find({
        where: {
            application_id: applicationId,
        },
        select: {
            id: true,
            sku_id: true,
            amount: true,
            description: true,
            entitlement_branches: true,
            entitlement_starts_at: true,
            entitlement_ends_at: true,
        },
        order: {
            id: "ASC",
        },
    });

    return batches.map(serializeApplicationGiftCodeBatch);
}

export function createApplicationGiftCodeBatchesRouter(repositories: ApplicationGiftCodeBatchRepositories = {}) {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Gift Code Batches",
            description: "Returns stored gift code batches for the given application.",
            responses: {
                200: {
                    body: "ApplicationGiftCodeBatchesResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const batches = await getApplicationGiftCodeBatches(req.params.application_id as string, req.user_id, repositories);

            return res.status(200).json(batches);
        },
    );

    return router;
}

export default createApplicationGiftCodeBatchesRouter();
