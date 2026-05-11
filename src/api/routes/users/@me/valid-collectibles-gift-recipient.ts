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
import type { CollectiblesGiftRecipientEligibilityResponse, Snowflake } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const snowflakePattern = /^[1-9]\d{16,19}$/;

export interface CollectiblesGiftRecipientEligibilityOptions {
    sender_id: Snowflake;
    recipient_id: Snowflake;
    sku_id: Snowflake;
}

export type CollectiblesGiftRecipientEligibilityProvider = (options: CollectiblesGiftRecipientEligibilityOptions) => boolean | Promise<boolean>;

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function queryString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function requiredSnowflake(value: unknown): Snowflake {
    const entry = queryString(value);
    if (!entry || !snowflakePattern.test(entry)) throw DiscordApiErrors.INVALID_FORM_BODY;

    return entry;
}

export function parseCollectiblesGiftRecipientQuery(query: Request["query"]) {
    return {
        recipient_id: requiredSnowflake(query.recipient_id),
        sku_id: requiredSnowflake(query.sku_id),
    };
}

export function getCollectiblesGiftRecipientEligibility(_options: CollectiblesGiftRecipientEligibilityOptions): boolean {
    // Spacebar currently has no persisted collectible gift, purchase ownership, or catalog eligibility backing.
    return false;
}

export async function getValidCollectiblesGiftRecipient(
    options: CollectiblesGiftRecipientEligibilityOptions,
    eligibilityProvider: CollectiblesGiftRecipientEligibilityProvider = getCollectiblesGiftRecipientEligibility,
): Promise<CollectiblesGiftRecipientEligibilityResponse> {
    if (options.sender_id === options.recipient_id) return { valid: false };

    return {
        valid: Boolean(await eligibilityProvider(options)),
    };
}

export function createCollectiblesGiftRecipientRouter(eligibilityProvider: CollectiblesGiftRecipientEligibilityProvider = getCollectiblesGiftRecipientEligibility) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Valid Collectibles Gift Recipient",
            description: "Returns gift eligibility for a recipient and collectible SKU.",
            query: {
                recipient_id: {
                    type: "string",
                    required: true,
                    description: "User ID to check for gift eligibility.",
                },
                sku_id: {
                    type: "string",
                    required: true,
                    description: "Collectible SKU ID to gift.",
                },
            },
            responses: {
                200: {
                    body: "CollectiblesGiftRecipientEligibilityResponse",
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
            const query = parseCollectiblesGiftRecipientQuery(req.query);
            const response = await getValidCollectiblesGiftRecipient(
                {
                    sender_id: req.user_id,
                    recipient_id: query.recipient_id,
                    sku_id: query.sku_id,
                },
                eligibilityProvider,
            );

            res.status(200).json(response);
        },
    );

    return router;
}

export default createCollectiblesGiftRecipientRouter();
