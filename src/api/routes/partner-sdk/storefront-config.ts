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
import type { PartnerSdkStorefrontConfigResponse } from "@spacebar/schemas";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const emptyPartnerSdkStorefrontConfig: PartnerSdkStorefrontConfigResponse = {
    promotional_sku_ids: [],
    promotion_end_datetime: null,
    storefronts: [],
};

export type PartnerSdkStorefrontConfigProvider = () => PartnerSdkStorefrontConfigResponse;

export function getPartnerSdkStorefrontConfig(): PartnerSdkStorefrontConfigResponse {
    return clonePartnerSdkStorefrontConfig(emptyPartnerSdkStorefrontConfig);
}

export function clonePartnerSdkStorefrontConfig(config: PartnerSdkStorefrontConfigResponse): PartnerSdkStorefrontConfigResponse {
    const cloned: PartnerSdkStorefrontConfigResponse = {
        promotional_sku_ids: [...config.promotional_sku_ids],
        promotion_end_datetime: config.promotion_end_datetime,
        storefronts: config.storefronts.map((storefront) => ({
            application_id: storefront.application_id,
            game_id: storefront.game_id,
            guild_id: storefront.guild_id,
            excluded_platforms: [...storefront.excluded_platforms],
            collectibles_shop_navigation_enabled: storefront.collectibles_shop_navigation_enabled,
        })),
    };

    if (config.announcement_modal_config !== undefined) {
        cloned.announcement_modal_config =
            config.announcement_modal_config === null
                ? null
                : {
                      application_id: config.announcement_modal_config.application_id,
                      version: config.announcement_modal_config.version,
                  };
    }

    return cloned;
}

export function createPartnerSdkStorefrontConfigRouter(provider: PartnerSdkStorefrontConfigProvider = getPartnerSdkStorefrontConfig) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Social Layer Storefront Config",
            description: "Returns the promotion currently running for Social Layer integrated storefronts.",
            responses: {
                200: {
                    body: "PartnerSdkStorefrontConfigResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (_req: Request, res: Response) => {
            res.status(200).json(clonePartnerSdkStorefrontConfig(provider()));
        },
    );

    return router;
}

export default createPartnerSdkStorefrontConfigRouter();
