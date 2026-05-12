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
    PartnerSdkApplicationStorefrontAsset,
    PartnerSdkApplicationStorefrontLeaderboard,
    PartnerSdkApplicationStorefrontPage,
    PartnerSdkApplicationStorefrontPageSection,
    PartnerSdkApplicationStorefrontResponse,
} from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";
import { requireApplicationStoreAccess, type ApplicationCommandAuthorizationRepository } from "../../../../util/utility/ApplicationAuthorization";
import { toStoreListingResponse, type StoreListingSource } from "../../../store/listings/#store_listing_id";

const routeSnowflakePattern = /^[1-9]\d{16,19}$/;

export const UNKNOWN_APPLICATION_STOREFRONT_ERROR = new ApiError("Unknown Storefront", 10033, 404);

export interface PartnerSdkApplicationStorefrontProviderOptions {
    application_id: string;
}

export interface PartnerSdkApplicationStorefrontSource {
    application_id: string;
    application?: object;
    title: string;
    logo_asset_id?: string | null;
    light_theme_logo_asset_id?: string | null;
    pages: readonly PartnerSdkApplicationStorefrontPage[];
    store_listings: readonly StoreListingSource[];
    assets: readonly PartnerSdkApplicationStorefrontAsset[];
}

export type PartnerSdkApplicationStorefrontProvider = (
    options: PartnerSdkApplicationStorefrontProviderOptions,
) => PartnerSdkApplicationStorefrontSource | undefined | Promise<PartnerSdkApplicationStorefrontSource | undefined>;

export type PartnerSdkApplicationStorefrontDependencies = {
    applicationRepository?: ApplicationCommandAuthorizationRepository;
    storefrontProvider?: PartnerSdkApplicationStorefrontProvider;
};

export function isPartnerSdkApplicationStorefrontApplicationId(value: string) {
    return routeSnowflakePattern.test(value);
}

export function getConfiguredPartnerSdkApplicationStorefront(_options: PartnerSdkApplicationStorefrontProviderOptions): PartnerSdkApplicationStorefrontSource | undefined {
    // Spacebar does not currently persist Discord application storefront layouts.
    return undefined;
}

function cloneLeaderboard(leaderboard: PartnerSdkApplicationStorefrontLeaderboard): PartnerSdkApplicationStorefrontLeaderboard {
    const response: PartnerSdkApplicationStorefrontLeaderboard = {};

    if (leaderboard.title !== undefined) response.title = leaderboard.title;
    if (leaderboard.description !== undefined) response.description = leaderboard.description;
    if (leaderboard.background_image_asset_id !== undefined) response.background_image_asset_id = leaderboard.background_image_asset_id;

    return response;
}

function clonePageSection(section: PartnerSdkApplicationStorefrontPageSection): PartnerSdkApplicationStorefrontPageSection {
    const response: PartnerSdkApplicationStorefrontPageSection = {
        sku_ids: [...section.sku_ids],
    };

    if (section.title !== undefined) response.title = section.title;

    return response;
}

function clonePage(page: PartnerSdkApplicationStorefrontPage): PartnerSdkApplicationStorefrontPage {
    const response: PartnerSdkApplicationStorefrontPage = {
        sku_ids: [...page.sku_ids],
    };

    if (page.title !== undefined) response.title = page.title;
    if (page.leaderboard !== undefined) response.leaderboard = cloneLeaderboard(page.leaderboard);
    if (page.sections !== undefined) response.sections = page.sections.map(clonePageSection);

    return response;
}

function cloneAsset(asset: PartnerSdkApplicationStorefrontAsset): PartnerSdkApplicationStorefrontAsset {
    const response: PartnerSdkApplicationStorefrontAsset = {
        id: asset.id,
        size: asset.size,
        mime_type: asset.mime_type,
        width: asset.width,
        height: asset.height,
    };

    if (asset.application_id !== undefined) response.application_id = asset.application_id;
    if (asset.filename !== undefined) response.filename = asset.filename;

    return response;
}

export function toPartnerSdkApplicationStorefrontResponse(source: PartnerSdkApplicationStorefrontSource): PartnerSdkApplicationStorefrontResponse {
    const response: PartnerSdkApplicationStorefrontResponse = {
        application_id: source.application_id,
        title: source.title,
        pages: source.pages.map(clonePage),
        store_listings: source.store_listings.map(toStoreListingResponse),
        assets: source.assets.map(cloneAsset),
    };

    if (source.application !== undefined) response.application = { ...source.application };
    if (source.logo_asset_id !== undefined) response.logo_asset_id = source.logo_asset_id;
    if (source.light_theme_logo_asset_id !== undefined) response.light_theme_logo_asset_id = source.light_theme_logo_asset_id;

    return response;
}

export async function getPartnerSdkApplicationStorefront(
    applicationId: string,
    userId: string,
    dependencies: PartnerSdkApplicationStorefrontDependencies = {},
): Promise<PartnerSdkApplicationStorefrontResponse> {
    if (!isPartnerSdkApplicationStorefrontApplicationId(applicationId)) throw DiscordApiErrors.UNKNOWN_APPLICATION;

    await requireApplicationStoreAccess(applicationId, userId, dependencies.applicationRepository);

    const provider = dependencies.storefrontProvider ?? getConfiguredPartnerSdkApplicationStorefront;
    const storefront = await provider({ application_id: applicationId });
    if (!storefront || storefront.application_id !== applicationId) throw UNKNOWN_APPLICATION_STOREFRONT_ERROR;

    return toPartnerSdkApplicationStorefrontResponse(storefront);
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

function sendUnknownApplicationStorefrontError(res: Response) {
    return res.status(404).json({
        code: UNKNOWN_APPLICATION_STOREFRONT_ERROR.code,
        message: UNKNOWN_APPLICATION_STOREFRONT_ERROR.message,
    });
}

function isApplicationAuthorizationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code;
}

function isUnknownApplicationError(error: unknown) {
    return (error as { code?: unknown })?.code === DiscordApiErrors.UNKNOWN_APPLICATION.code;
}

function isUnknownApplicationStorefrontError(error: unknown) {
    return (error as { code?: unknown })?.code === UNKNOWN_APPLICATION_STOREFRONT_ERROR.code;
}

export function createPartnerSdkApplicationStorefrontRouter(dependencies: PartnerSdkApplicationStorefrontDependencies = {}) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Application Storefront",
            description: "Returns the locally backed application storefront layout when the current user can access the owning application.",
            responses: {
                200: {
                    body: "PartnerSdkApplicationStorefrontResponse",
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
                const storefront = await getPartnerSdkApplicationStorefront(req.params.application_id as string, req.user_id, dependencies);

                return res.status(200).json(storefront);
            } catch (error) {
                if (isApplicationAuthorizationError(error)) return sendApplicationAuthorizationError(res);
                if (isUnknownApplicationError(error)) return sendUnknownApplicationError(res);
                if (isUnknownApplicationStorefrontError(error)) return sendUnknownApplicationStorefrontError(res);
                throw error;
            }
        },
    );

    return router;
}

export default createPartnerSdkApplicationStorefrontRouter();
