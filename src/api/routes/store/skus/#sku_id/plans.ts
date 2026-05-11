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
import type { StorePublishedListingsSkusSubscriptionPlansResponse } from "@spacebar/schemas";
import { ApiError, Config, DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { requireApplicationStoreAccess, type ApplicationCommandAuthorizationRepository } from "../../../../util/utility/ApplicationAuthorization";
import type { SubscriptionPlan } from "../../published-listings/skus/#sku_id/subscription-plans";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export interface StoreSkuPlansSkuProviderOptions {
    sku_id: string;
    localize: boolean;
}

export interface StoreSkuPlansSkuSource {
    application_id: string;
}

export type StoreSkuPlansSkuProvider = (options: StoreSkuPlansSkuProviderOptions) => StoreSkuPlansSkuSource | undefined | Promise<StoreSkuPlansSkuSource | undefined>;

export interface StoreSkuPlansProviderOptions {
    sku_id: string;
}

export type StoreSkuPlansProvider = (options: StoreSkuPlansProviderOptions) => readonly SubscriptionPlan[] | Promise<readonly SubscriptionPlan[]>;

export type StoreSkuPlansRouteDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    skuProvider?: StoreSkuPlansSkuProvider;
    subscriptionPlansProvider?: StoreSkuPlansProvider;
};

export const UNKNOWN_STORE_SKU_ERROR = new ApiError("Unknown SKU", 10027, 404);

export function getConfiguredStoreSkuForPlans(_options: StoreSkuPlansSkuProviderOptions): StoreSkuPlansSkuSource | undefined {
    // Spacebar does not currently persist Discord's SKU catalog.
    return undefined;
}

export async function requireStoreSkuPlansAccess(skuId: string, userId: string, dependencies: StoreSkuPlansRouteDependencies = {}): Promise<StoreSkuPlansSkuSource> {
    if (!routeSnowflakePattern.test(skuId)) throw UNKNOWN_STORE_SKU_ERROR;

    const provider = dependencies.skuProvider ?? getConfiguredStoreSkuForPlans;
    const sku = await provider({ sku_id: skuId, localize: true });
    if (!sku) throw UNKNOWN_STORE_SKU_ERROR;

    await requireApplicationStoreAccess(sku.application_id, userId, dependencies.applicationRepository);
    return sku;
}

export function getConfiguredStoreSkuPlans(
    options: StoreSkuPlansProviderOptions,
    customPlans: readonly SubscriptionPlan[] = Config.get().store.customSubscriptionPlans,
): readonly SubscriptionPlan[] {
    return customPlans.filter((plan) => plan.sku_id === options.sku_id);
}

export async function listStoreSkuSubscriptionPlans(
    skuId: string,
    userId: string,
    dependencies: StoreSkuPlansRouteDependencies = {},
): Promise<StorePublishedListingsSkusSubscriptionPlansResponse> {
    await requireStoreSkuPlansAccess(skuId, userId, dependencies);

    const provider = dependencies.subscriptionPlansProvider ?? getConfiguredStoreSkuPlans;
    return Array.from(await provider({ sku_id: skuId }));
}

function sendApplicationAuthorizationError(res: Response) {
    return res.status(403).json({
        code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

export function createStoreSkuPlansRouter(dependencies: StoreSkuPlansRouteDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Subscription Plans",
            description: "Returns locally backed subscription plan objects for the given SKU ID after verifying the current user can access the SKU's owning application.",
            responses: {
                200: {
                    body: "StorePublishedListingsSkusSubscriptionPlansResponse",
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
            try {
                const plans = await listStoreSkuSubscriptionPlans(req.params.sku_id as string, req.user_id, dependencies);

                return res.status(200).json(plans);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createStoreSkuPlansRouter();
