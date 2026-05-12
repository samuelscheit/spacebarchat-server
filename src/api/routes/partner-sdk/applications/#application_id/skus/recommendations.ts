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
import type {
    PartnerSdkApplicationSkuRecommendation,
    PartnerSdkApplicationSkuRecommendationApplication,
    PartnerSdkApplicationSkuRecommendationReason,
    PartnerSdkApplicationSkuRecommendationsResponse,
    StoreSkuResponse,
} from "@spacebar/schemas";
import { Application, DiscordApiErrors, FieldErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import type { FindOneOptions } from "typeorm";
import { toStoreSkuResponse } from "../../../../../util/utility/StoreSkuRoute";

const maxPartnerSdkApplicationSkuRecommendationUserIds = 100;
const maxPartnerSdkApplicationSkuRecommendations = 25;
const partnerSdkApplicationSkuRecommendationsSnowflakePattern = /^[1-9]\d{16,19}$/;
const partnerSdkApplicationSkuRecommendationReasons = new Set<PartnerSdkApplicationSkuRecommendationReason>(["WISHLIST", "RECOMMENDATION"]);

const emptyPartnerSdkApplicationSkuRecommendations: PartnerSdkApplicationSkuRecommendationsSource = {
    skus: [],
    skus_to_user_ids: {},
};

export interface PartnerSdkApplicationSkuRecommendationsQueryOptions {
    user_ids: string[];
    max_recommendations?: number;
    include_wishlists: boolean;
}

export type PartnerSdkApplicationSkuRecommendationsApplicationSource = Pick<Application, "description" | "flags" | "icon" | "id" | "name" | "type">;

export interface PartnerSdkApplicationSkuRecommendationsProviderOptions extends PartnerSdkApplicationSkuRecommendationsQueryOptions {
    application_id: string;
    application: PartnerSdkApplicationSkuRecommendationsApplicationSource;
}

export interface PartnerSdkApplicationSkuRecommendationsSource {
    skus?: readonly StoreSkuResponse[];
    skus_to_user_ids?: PartnerSdkApplicationSkuRecommendationsSourceMap;
}

export type PartnerSdkApplicationSkuRecommendationsSourceMap = Readonly<Record<string, PartnerSdkApplicationSkuRecommendation | undefined>>;

export type PartnerSdkApplicationSkuRecommendationsProvider = (
    options: PartnerSdkApplicationSkuRecommendationsProviderOptions,
) => PartnerSdkApplicationSkuRecommendationsSource | Promise<PartnerSdkApplicationSkuRecommendationsSource>;

export type PartnerSdkApplicationSkuRecommendationsApplicationRepository = {
    findOne(options: FindOneOptions<Application>): Promise<PartnerSdkApplicationSkuRecommendationsApplicationSource | null>;
};

export type PartnerSdkApplicationSkuRecommendationsDependencies = {
    applicationRepository?: PartnerSdkApplicationSkuRecommendationsApplicationRepository;
    recommendationsProvider?: PartnerSdkApplicationSkuRecommendationsProvider;
};

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function queryValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(queryValues);
    if (typeof value !== "string") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function queryString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

function queryFieldError(field: string, code: string, message: string): never {
    throw FieldErrors({
        [field]: {
            code,
            message,
        },
    });
}

function queryBoolean(value: unknown, field: string, defaultValue: boolean): boolean {
    const entry = queryString(value);
    if (entry === undefined) return defaultValue;
    if (entry === "true" || entry === "1") return true;
    if (entry === "false" || entry === "0") return false;

    return queryFieldError(field, "BASE_TYPE_INVALID", `${field} must be a boolean`);
}

function queryInteger(value: unknown, field: string, min: number, max: number): number | undefined {
    const entry = queryString(value);
    if (entry === undefined) return undefined;
    if (!/^\d+$/.test(entry)) return queryFieldError(field, "BASE_TYPE_INVALID", `${field} must be an integer`);

    const parsed = Number.parseInt(entry, 10);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
        return queryFieldError(field, "BASE_TYPE_BAD_LENGTH", `${field} must be between ${min} and ${max}`);
    }

    return parsed;
}

export function isPartnerSdkApplicationSkuRecommendationsSnowflake(value: string) {
    return partnerSdkApplicationSkuRecommendationsSnowflakePattern.test(value);
}

function requiredUserIds(values: string[]): string[] {
    if (values.length === 0) {
        queryFieldError("user_ids", "BASE_TYPE_REQUIRED", "user_ids is required");
    }

    if (values.length > maxPartnerSdkApplicationSkuRecommendationUserIds) {
        queryFieldError("user_ids", "BASE_TYPE_BAD_LENGTH", "user_ids must contain between 1 and 100 values");
    }

    if (values.some((userId) => !isPartnerSdkApplicationSkuRecommendationsSnowflake(userId))) {
        queryFieldError("user_ids", "BASE_TYPE_INVALID", "user_ids must contain valid snowflakes");
    }

    return [...new Set(values)];
}

export function parsePartnerSdkApplicationSkuRecommendationsQuery(query: Request["query"]): PartnerSdkApplicationSkuRecommendationsQueryOptions {
    return {
        user_ids: requiredUserIds([...queryValues(query.user_ids), ...queryValues(query["user_ids[]"])]),
        max_recommendations: queryInteger(query.max_recommendations, "max_recommendations", 1, maxPartnerSdkApplicationSkuRecommendations),
        include_wishlists: queryBoolean(query.include_wishlists, "include_wishlists", false),
    };
}

function getApplicationRepository(repository?: PartnerSdkApplicationSkuRecommendationsApplicationRepository): PartnerSdkApplicationSkuRecommendationsApplicationRepository {
    return repository ?? (Application.getRepository() as unknown as PartnerSdkApplicationSkuRecommendationsApplicationRepository);
}

export function toPartnerSdkApplicationSkuRecommendationApplication(
    application: PartnerSdkApplicationSkuRecommendationsApplicationSource,
): PartnerSdkApplicationSkuRecommendationApplication {
    return {
        id: application.id,
        name: application.name,
        description: application.description ?? "",
        icon: application.icon ?? null,
        type: application.type ?? null,
        flags: application.flags,
    };
}

export function getConfiguredPartnerSdkApplicationSkuRecommendations(
    _options: PartnerSdkApplicationSkuRecommendationsProviderOptions,
): PartnerSdkApplicationSkuRecommendationsSource {
    // Spacebar does not currently persist Discord application SKU recommendation state.
    return emptyPartnerSdkApplicationSkuRecommendations;
}

function isPartnerSdkApplicationSkuRecommendationReason(value: unknown): value is PartnerSdkApplicationSkuRecommendationReason {
    return typeof value === "string" && partnerSdkApplicationSkuRecommendationReasons.has(value as PartnerSdkApplicationSkuRecommendationReason);
}

export function toPartnerSdkApplicationSkuRecommendationsResponse(
    application: PartnerSdkApplicationSkuRecommendationsApplicationSource,
    recommendations: PartnerSdkApplicationSkuRecommendationsSource,
    options: PartnerSdkApplicationSkuRecommendationsQueryOptions,
): PartnerSdkApplicationSkuRecommendationsResponse {
    const recommendationLimit = options.max_recommendations ?? recommendations.skus?.length ?? 0;
    const skus = (recommendations.skus ?? []).slice(0, recommendationLimit).map(toStoreSkuResponse);
    const skuIds = new Set(skus.map((sku) => sku.id));
    const userIds = new Set(options.user_ids);
    const skusToUserIds: PartnerSdkApplicationSkuRecommendationsResponse["skus_to_user_ids"] = {};

    for (const [skuId, recommendation] of Object.entries(recommendations.skus_to_user_ids ?? {})) {
        if (
            !recommendation ||
            !skuIds.has(skuId) ||
            !userIds.has(recommendation.user_id) ||
            !isPartnerSdkApplicationSkuRecommendationReason(recommendation.reason) ||
            (recommendation.reason === "WISHLIST" && !options.include_wishlists)
        ) {
            continue;
        }

        skusToUserIds[skuId] = {
            user_id: recommendation.user_id,
            reason: recommendation.reason,
        };
    }

    return {
        skus,
        skus_to_user_ids: skusToUserIds,
        application: toPartnerSdkApplicationSkuRecommendationApplication(application),
    };
}

export async function getPartnerSdkApplicationSkuRecommendations(
    applicationId: string,
    options: PartnerSdkApplicationSkuRecommendationsQueryOptions,
    dependencies: PartnerSdkApplicationSkuRecommendationsDependencies = {},
): Promise<PartnerSdkApplicationSkuRecommendationsResponse> {
    if (!isPartnerSdkApplicationSkuRecommendationsSnowflake(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    const applicationRepository = getApplicationRepository(dependencies.applicationRepository);
    const application = await applicationRepository.findOne({
        where: { id: applicationId },
        select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            type: true,
            flags: true,
        },
    });

    if (!application) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    const provider = dependencies.recommendationsProvider ?? getConfiguredPartnerSdkApplicationSkuRecommendations;
    const recommendations = await provider({
        application_id: applicationId,
        application,
        ...options,
    });

    return toPartnerSdkApplicationSkuRecommendationsResponse(application, recommendations, options);
}

export function createPartnerSdkApplicationSkuRecommendationsRouter(dependencies: PartnerSdkApplicationSkuRecommendationsDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application SKU Recommendations",
            description: "Returns locally backed giftable SKU recommendations for the requested users and application.",
            query: {
                user_ids: {
                    type: "array",
                    required: true,
                    description: "User IDs to retrieve application SKU recommendations for (1-100).",
                },
                max_recommendations: {
                    type: "number",
                    description: "Maximum number of recommendations to return (1-25).",
                },
                include_wishlists: {
                    type: "boolean",
                    description: "Whether to include wishlist-backed recommendations.",
                },
            },
            responses: {
                200: {
                    body: "PartnerSdkApplicationSkuRecommendationsResponse",
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
            const query = parsePartnerSdkApplicationSkuRecommendationsQuery(req.query);
            const recommendations = await getPartnerSdkApplicationSkuRecommendations(req.params.application_id as string, query, dependencies);

            return res.status(200).json(recommendations);
        },
    );

    return router;
}

export default createPartnerSdkApplicationSkuRecommendationsRouter();
