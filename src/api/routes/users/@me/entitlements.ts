/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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
import type { UserEntitlementsResponse } from "@spacebar/schemas";
import { Router as createRouter, type Request, type Response, type Router } from "express";

export function getCurrentUserEntitlements(): UserEntitlementsResponse {
    // Spacebar currently has no durable global current-user entitlement store.
    return [];
}

export function createUserEntitlementsRouter() {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get User Entitlements",
            description: "Returns locally backed current-user entitlements without fabricating Discord commerce state.",
            query: {
                with_sku: {
                    type: "boolean",
                    description: "Whether SKU data should be included when backed by local entitlement state.",
                },
                with_application: {
                    type: "boolean",
                    description: "Whether application data should be included when backed by local entitlement state.",
                },
                entitlement_type: {
                    type: "integer",
                    description: "Filters entitlements by type when backed by local entitlement state.",
                },
                exclude_ended: {
                    type: "boolean",
                    description: "Whether ended entitlements should be excluded when backed by local entitlement state.",
                },
            },
            responses: {
                200: {
                    body: "UserEntitlementsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (_req: Request, res: Response) => {
            res.status(200).json(getCurrentUserEntitlements());
        },
    );

    router.get(
        "/gifts",
        route({
            responses: {
                200: {
                    body: "UserEntitlementGiftsResponse",
                },
            },
        }),
        (_req: Request, res: Response) => {
            res.status(200).json([]);
        },
    );

    return router;
}

export default createUserEntitlementsRouter();
