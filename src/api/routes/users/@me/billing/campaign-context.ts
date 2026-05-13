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
import type { BillingCampaignContextResponse } from "@spacebar/schemas";
import { Request, Response, Router as createRouter, type Router } from "express";

export function createBillingCampaignContextResponse(): BillingCampaignContextResponse {
    return {};
}

export function createUserBillingCampaignContextRouter() {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Billing Campaign Context",
            description:
                "Returns locally persisted billing campaign attribution context for the current user. Spacebar does not currently persist Discord billing campaign attribution state, so the supported representation is an empty object.",
            responses: {
                200: {
                    body: "BillingCampaignContextResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (_req: Request, res: Response) => res.status(200).json(createBillingCampaignContextResponse()),
    );

    return router;
}

export default createUserBillingCampaignContextRouter();
