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
import { DiscordApiErrors } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        summary: "Get Gift Code",
        description: "Returns a gift code object for the given code.",
        query: {
            with_application: {
                type: "boolean",
                description: "Whether to include the application object in the SKU.",
            },
            with_subscription_plan: {
                type: "boolean",
                description: "Whether to include the subscription plan object in the response.",
            },
        },
        responses: {
            200: {
                body: "GiftCodeResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    (_req: Request, _res: Response) => {
        // Spacebar has no durable gift-code store yet, so no code can resolve to a redeemable gift.
        throw DiscordApiErrors.UNKNOWN_GIFT_CODE;
    },
);

export default router;
