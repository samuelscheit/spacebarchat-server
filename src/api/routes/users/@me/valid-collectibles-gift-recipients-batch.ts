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
import type { CollectiblesGiftRecipientsBatchEligibilityResponse, Snowflake } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { getCollectiblesGiftRecipientEligibility, getValidCollectiblesGiftRecipient, type CollectiblesGiftRecipientEligibilityProvider } from "./valid-collectibles-gift-recipient";

const snowflakePattern = /^[1-9]\d{16,19}$/;
const maxCollectiblesGiftBatchSkuIds = 100;

export interface CollectiblesGiftRecipientsBatchEligibilityOptions {
    sender_id: Snowflake;
    recipient_id: Snowflake;
    sku_ids: Snowflake[];
}

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function queryString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function isSnowflake(value: string): value is Snowflake {
    return snowflakePattern.test(value);
}

function requiredSnowflake(value: unknown): Snowflake {
    const entry = queryString(value);
    if (!entry || !isSnowflake(entry)) throw DiscordApiErrors.INVALID_FORM_BODY;

    return entry;
}

function requiredSkuIds(values: string[]): Snowflake[] {
    if (values.length === 0 || values.length > maxCollectiblesGiftBatchSkuIds) throw DiscordApiErrors.INVALID_FORM_BODY;

    for (const value of values) {
        if (!isSnowflake(value)) throw DiscordApiErrors.INVALID_FORM_BODY;
    }

    return [...new Set(values)] as Snowflake[];
}

export function parseCollectiblesGiftRecipientsBatchQuery(query: Request["query"]): Omit<CollectiblesGiftRecipientsBatchEligibilityOptions, "sender_id"> {
    return {
        recipient_id: requiredSnowflake(query.recipient_id),
        sku_ids: requiredSkuIds([...queryValues(query.sku_ids), ...queryValues(query["sku_ids[]"])]),
    };
}

export async function getValidCollectiblesGiftRecipientsBatch(
    options: CollectiblesGiftRecipientsBatchEligibilityOptions,
    eligibilityProvider: CollectiblesGiftRecipientEligibilityProvider = getCollectiblesGiftRecipientEligibility,
): Promise<CollectiblesGiftRecipientsBatchEligibilityResponse> {
    const response: CollectiblesGiftRecipientsBatchEligibilityResponse = {};

    for (const sku_id of options.sku_ids) {
        response[sku_id] = await getValidCollectiblesGiftRecipient(
            {
                sender_id: options.sender_id,
                recipient_id: options.recipient_id,
                sku_id,
            },
            eligibilityProvider,
        );
    }

    return response;
}

export function createCollectiblesGiftRecipientsBatchRouter(eligibilityProvider: CollectiblesGiftRecipientEligibilityProvider = getCollectiblesGiftRecipientEligibility) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Valid Collectibles Gift Recipients Batch",
            description: "Returns gift eligibility by collectible SKU for a recipient.",
            query: {
                recipient_id: {
                    type: "string",
                    required: true,
                    description: "User ID to check for gift eligibility.",
                },
                sku_ids: {
                    type: "array",
                    required: true,
                    description: "Collectible SKU IDs to check for gift eligibility (1-100).",
                },
            },
            responses: {
                200: {
                    body: "CollectiblesGiftRecipientsBatchEligibilityResponse",
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
            const query = parseCollectiblesGiftRecipientsBatchQuery(req.query);
            const response = await getValidCollectiblesGiftRecipientsBatch(
                {
                    sender_id: req.user_id,
                    recipient_id: query.recipient_id,
                    sku_ids: query.sku_ids,
                },
                eligibilityProvider,
            );

            res.status(200).json(response);
        },
    );

    return router;
}

export default createCollectiblesGiftRecipientsBatchRouter();
