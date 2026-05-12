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
import type { VirtualCurrencyBalanceResponse } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

export const DefaultVirtualCurrencyBalanceResponse: Readonly<VirtualCurrencyBalanceResponse> = Object.freeze({
    balance: 0,
});

export function getCurrentUserVirtualCurrencyBalance(_userId: string): VirtualCurrencyBalanceResponse {
    // Spacebar currently has no durable Orbs ledger, so the only locally
    // truthful current-user balance is the empty balance.
    return { ...DefaultVirtualCurrencyBalanceResponse };
}

export function createCurrentUserVirtualCurrencyBalanceRouter() {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Virtual Currency Balance",
            description: "Returns the current user's locally backed Orbs balance without fabricating Discord virtual-currency state.",
            responses: {
                200: {
                    body: "VirtualCurrencyBalanceResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            res.status(200).json(getCurrentUserVirtualCurrencyBalance(req.user_id));
        },
    );

    return router;
}

export default createCurrentUserVirtualCurrencyBalanceRouter();
