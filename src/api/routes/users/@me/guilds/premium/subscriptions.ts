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
import type { UserGuildPremiumSubscriptionsResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export function getCurrentUserGuildPremiumSubscriptions(): UserGuildPremiumSubscriptionsResponse {
    // Spacebar does not persist Discord current-user guild boost subscription records yet.
    return [];
}

export function createUserGuildPremiumSubscriptionsRouter() {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Applied Premium Guild Subscriptions",
            description:
                "Returns locally backed current-user guild premium subscriptions. Spacebar does not persist Discord guild boost subscription records yet, so the supported representation is an empty list.",
            responses: {
                200: {
                    body: "UserGuildPremiumSubscriptionsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (_req: Request, res: Response) => {
            res.status(200).json(getCurrentUserGuildPremiumSubscriptions());
        },
    );

    return router;
}

export default createUserGuildPremiumSubscriptionsRouter();
