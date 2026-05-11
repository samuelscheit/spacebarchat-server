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
import type { StoreSkuResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors, FieldErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { requireApplicationStoreAccess, type ApplicationCommandAuthorizationRepository } from "../../../util/utility/ApplicationAuthorization";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export interface StoreSkuQueryOptions {
    country_code?: string;
    localize: boolean;
}

export interface StoreSkuProviderOptions extends StoreSkuQueryOptions {
    sku_id: string;
}

export type StoreSkuSource = StoreSkuResponse;
export type StoreSkuProvider = (options: StoreSkuProviderOptions) => StoreSkuSource | undefined | Promise<StoreSkuSource | undefined>;

export type StoreSkuRouteDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    skuProvider?: StoreSkuProvider;
};

export const UNKNOWN_STORE_SKU_ERROR = new ApiError("Unknown SKU", 10027, 404);

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function queryString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function queryBoolean(value: unknown, field: string, defaultValue: boolean): boolean {
    const entry = queryString(value);
    if (entry === undefined) return defaultValue;
    if (entry === "true" || entry === "1") return true;
    if (entry === "false" || entry === "0") return false;

    throw FieldErrors({
        [field]: {
            code: "BASE_TYPE_INVALID",
            message: `${field} must be a boolean`,
        },
    });
}

export function isStoreSkuRouteSnowflake(value: string) {
    return routeSnowflakePattern.test(value);
}

export function parseStoreSkuQuery(query: Request["query"]): StoreSkuQueryOptions {
    return {
        country_code: queryString(query.country_code),
        localize: queryBoolean(query.localize, "localize", true),
    };
}

export function getConfiguredStoreSku(_options: StoreSkuProviderOptions): StoreSkuResponse | undefined {
    // Spacebar does not currently persist Discord's SKU catalog.
    return undefined;
}

export function toStoreSkuResponse(sku: StoreSkuSource): StoreSkuResponse {
    const response: StoreSkuResponse = {
        id: sku.id,
        type: sku.type,
        application_id: sku.application_id,
        product_line: sku.product_line,
        flags: sku.flags,
        name: sku.name,
        slug: sku.slug,
        access_type: sku.access_type,
        features: [...sku.features],
        premium: sku.premium,
        show_age_gate: sku.show_age_gate,
    };

    if (sku.application !== undefined) response.application = sku.application;
    if (sku.product_id !== undefined) response.product_id = sku.product_id;
    if (sku.summary !== undefined) response.summary = sku.summary;
    if (sku.description !== undefined) response.description = sku.description;
    if (sku.legal_notice !== undefined) response.legal_notice = sku.legal_notice;
    if (sku.thumbnail_asset_id !== undefined) response.thumbnail_asset_id = sku.thumbnail_asset_id;
    if (sku.dependent_sku_id !== undefined) response.dependent_sku_id = sku.dependent_sku_id;
    if (sku.bundled_skus !== undefined) response.bundled_skus = sku.bundled_skus.map(toStoreSkuResponse);
    if (sku.bundled_sku_ids !== undefined) response.bundled_sku_ids = [...sku.bundled_sku_ids];
    if (sku.manifest_labels !== undefined) response.manifest_labels = sku.manifest_labels ? [...sku.manifest_labels] : null;
    if (sku.locales !== undefined) response.locales = [...sku.locales];
    if (sku.genres !== undefined) response.genres = [...sku.genres];
    if (sku.available_regions !== undefined) response.available_regions = [...sku.available_regions];
    if (sku.content_rating !== undefined) response.content_rating = sku.content_rating;
    if (sku.content_rating_agency !== undefined) response.content_rating_agency = sku.content_rating_agency;
    if (sku.content_ratings !== undefined) response.content_ratings = sku.content_ratings;
    if (sku.system_requirements !== undefined) response.system_requirements = sku.system_requirements;
    if (sku.price !== undefined) response.price = sku.price;
    if (sku.price_tier !== undefined) response.price_tier = sku.price_tier;
    if (sku.sale_price_tier !== undefined) response.sale_price_tier = sku.sale_price_tier;
    if (sku.sale_price !== undefined) response.sale_price = sku.sale_price;
    if (sku.created_at !== undefined) response.created_at = sku.created_at;
    if (sku.updated_at !== undefined) response.updated_at = sku.updated_at;
    if (sku.release_date !== undefined) response.release_date = sku.release_date;
    if (sku.preorder_approximate_release_date !== undefined) response.preorder_approximate_release_date = sku.preorder_approximate_release_date;
    if (sku.preorder_released_at !== undefined) response.preorder_released_at = sku.preorder_released_at;
    if (sku.external_purchase_url !== undefined) response.external_purchase_url = sku.external_purchase_url;
    if (sku.external_sku_strategies !== undefined) response.external_sku_strategies = sku.external_sku_strategies;
    if (sku.eligible_payment_gateways !== undefined) response.eligible_payment_gateways = [...sku.eligible_payment_gateways];
    if (sku.restricted !== undefined) response.restricted = sku.restricted;
    if (sku.exclusive !== undefined) response.exclusive = sku.exclusive;
    if (sku.deleted !== undefined) response.deleted = sku.deleted;
    if (sku.tenant_metadata !== undefined) response.tenant_metadata = sku.tenant_metadata;
    if (sku.powerup_metadata !== undefined) response.powerup_metadata = sku.powerup_metadata;
    if (sku.orbs_reward !== undefined) response.orbs_reward = sku.orbs_reward;

    return response;
}

export async function getStoreSku(skuId: string, userId: string, options: StoreSkuQueryOptions, dependencies: StoreSkuRouteDependencies = {}): Promise<StoreSkuResponse> {
    if (!isStoreSkuRouteSnowflake(skuId)) throw UNKNOWN_STORE_SKU_ERROR;

    const provider = dependencies.skuProvider ?? getConfiguredStoreSku;
    const sku = await provider({ sku_id: skuId, ...options });
    if (!sku) throw UNKNOWN_STORE_SKU_ERROR;

    await requireApplicationStoreAccess(sku.application_id, userId, dependencies.applicationRepository);

    return toStoreSkuResponse(sku);
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

export function createStoreSkuRouter(dependencies: StoreSkuRouteDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get SKU",
            description: "Returns the SKU object for the given SKU ID when it is backed by local store data and the current user can access the owning application.",
            query: {
                country_code: {
                    type: "string",
                    description: "ISO 3166-1 alpha-2 country code used for localized pricing.",
                },
                localize: {
                    type: "boolean",
                    description: "Whether to localize the SKU for the viewer's location (default true).",
                },
            },
            responses: {
                200: {
                    body: "StoreSkuResponse",
                },
                400: {
                    body: "APIErrorResponse",
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
                const query = parseStoreSkuQuery(req.query);
                const sku = await getStoreSku(req.params.sku_id as string, req.user_id, query, dependencies);

                return res.status(200).json(sku);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createStoreSkuRouter();
