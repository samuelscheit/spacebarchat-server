/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { route } from "@spacebar/api";
import type { ClaimedPromotionsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export function getCurrentUserClaimedOutboundPromotionCodes(_userId: string): ClaimedPromotionsResponse {
    // Spacebar currently has no configured promotion-code provider.
    return [];
}

export function createCurrentUserClaimedOutboundPromotionCodesRouter() {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Claimed Promotions",
            description: "Returns locally backed claimed outbound promotions for the current user without fabricating Discord promotion-code state.",
            query: {
                locale: {
                    type: "string",
                    description: "Locale to return promotions in.",
                },
            },
            responses: {
                200: {
                    body: "ClaimedPromotionsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            res.status(200).json(getCurrentUserClaimedOutboundPromotionCodes(req.user_id));
        },
    );

    return router;
}

export default createCurrentUserClaimedOutboundPromotionCodesRouter();
