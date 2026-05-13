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
import type { PartnerSdkApplicationSkuCreateSchema, PartnerSdkApplicationSkusResponse, StoreSkuResponse } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { requireApplicationStoreAccess, type ApplicationCommandAuthorizationRepository } from "../../../../util/utility/ApplicationAuthorization";
import { toStoreSkuResponse } from "../../../../util/utility/StoreSkuRoute";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;
const socialLayerGameItemProductLine = 14;
const emptyPartnerSdkApplicationSkus: readonly StoreSkuResponse[] = [];

export const PARTNER_SDK_APPLICATION_SKU_CREATE_UNSUPPORTED_MESSAGE = "Social Layer SKU creation is not supported on this Spacebar instance.";

export interface PartnerSdkApplicationSkusProviderOptions {
    application_id: string;
}

export interface PartnerSdkApplicationSkuCreateProviderOptions extends PartnerSdkApplicationSkuCreateSchema {
    application_id: string;
}

export type PartnerSdkApplicationSkuSource = StoreSkuResponse;
export type PartnerSdkApplicationSkusProvider = (
    options: PartnerSdkApplicationSkusProviderOptions,
) => readonly PartnerSdkApplicationSkuSource[] | Promise<readonly PartnerSdkApplicationSkuSource[]>;
export type PartnerSdkApplicationSkuCreateProvider = (
    options: PartnerSdkApplicationSkuCreateProviderOptions,
) => PartnerSdkApplicationSkuSource | undefined | Promise<PartnerSdkApplicationSkuSource | undefined>;

export type PartnerSdkApplicationSkusDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    createSkuProvider?: PartnerSdkApplicationSkuCreateProvider;
    skusProvider?: PartnerSdkApplicationSkusProvider;
};

export function isPartnerSdkApplicationSkusApplicationId(value: string) {
    return routeSnowflakePattern.test(value);
}

export function getConfiguredPartnerSdkApplicationSkus(_options: PartnerSdkApplicationSkusProviderOptions): readonly StoreSkuResponse[] {
    // Spacebar does not currently persist Discord Social Layer SKU catalogs.
    return emptyPartnerSdkApplicationSkus;
}

export function createPartnerSdkApplicationSkuUnsupportedError(): ApiError {
    return new ApiError(PARTNER_SDK_APPLICATION_SKU_CREATE_UNSUPPORTED_MESSAGE, 0, 501);
}

export function toPartnerSdkApplicationSkusResponse(applicationId: string, skus: readonly PartnerSdkApplicationSkuSource[]): PartnerSdkApplicationSkusResponse {
    return skus.filter((sku) => sku.application_id === applicationId && sku.product_line === socialLayerGameItemProductLine).map((sku) => toStoreSkuResponse(sku));
}

export async function listPartnerSdkApplicationSkus(
    applicationId: string,
    userId: string,
    dependencies: PartnerSdkApplicationSkusDependencies = {},
): Promise<PartnerSdkApplicationSkusResponse> {
    if (!isPartnerSdkApplicationSkusApplicationId(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    await requireApplicationStoreAccess(applicationId, userId, dependencies.applicationRepository);

    const provider = dependencies.skusProvider ?? getConfiguredPartnerSdkApplicationSkus;
    const skus = await provider({ application_id: applicationId });

    return toPartnerSdkApplicationSkusResponse(applicationId, skus);
}

export async function createPartnerSdkApplicationSku(
    applicationId: string,
    userId: string,
    body: PartnerSdkApplicationSkuCreateSchema,
    dependencies: PartnerSdkApplicationSkusDependencies = {},
): Promise<StoreSkuResponse> {
    if (!isPartnerSdkApplicationSkusApplicationId(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    await requireApplicationStoreAccess(applicationId, userId, dependencies.applicationRepository);

    const provider = dependencies.createSkuProvider;
    if (!provider) throw createPartnerSdkApplicationSkuUnsupportedError();

    const sku = await provider({
        application_id: applicationId,
        name: body.name,
        price_tier: body.price_tier,
    });

    if (!sku || sku.application_id !== applicationId || sku.product_line !== socialLayerGameItemProductLine) {
        throw createPartnerSdkApplicationSkuUnsupportedError();
    }

    return toStoreSkuResponse(sku);
}

function sendApplicationAuthorizationError(res: Response) {
    return res.status(403).json({
        code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
        message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
    });
}

function sendUnknownApplicationError(res: Response) {
    return res.status(404).json({
        code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
        message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

function isUnknownApplicationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.UNKNOWN_APPLICATION.code;
}

export function createPartnerSdkApplicationSkusRouter(dependencies: PartnerSdkApplicationSkusDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Social Layer SKUs",
            description: "Returns locally backed Social Layer game item SKUs for the given application when the current user can access the owning application.",
            responses: {
                200: {
                    body: "PartnerSdkApplicationSkusResponse",
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
                const skus = await listPartnerSdkApplicationSkus(req.params.application_id as string, req.user_id, dependencies);

                return res.status(200).json(skus);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                if (isUnknownApplicationError(error)) return sendUnknownApplicationError(res);
                throw error;
            }
        },
    );

    router.post(
        "/",
        route({
            summary: "Create Social Layer SKU",
            description:
                "Creates a locally backed Social Layer game item SKU for the given application when a Social Layer SKU provider is configured; otherwise fails closed after application store access checks.",
            requestBody: "PartnerSdkApplicationSkuCreateSchema",
            coerceRequestBody: false,
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
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            try {
                const sku = await createPartnerSdkApplicationSku(req.params.application_id as string, req.user_id, req.body as PartnerSdkApplicationSkuCreateSchema, dependencies);

                return res.status(200).json(sku);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                if (isUnknownApplicationError(error)) return sendUnknownApplicationError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createPartnerSdkApplicationSkusRouter();
