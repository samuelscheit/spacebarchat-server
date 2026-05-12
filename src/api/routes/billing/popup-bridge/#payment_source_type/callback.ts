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
import type { BillingPopupBridgeCallbackSchema } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

export const BILLING_POPUP_BRIDGE_CALLBACK_UNSUPPORTED_MESSAGE =
    "Billing popup bridge callbacks require local payment popup bridge state and a billing provider integration, which this Spacebar instance does not support.";

export type BillingPopupBridgeCallback = {
    paymentSourceType: string;
    userId: string;
    state: string;
    path: string;
    query?: Record<string, string>;
    insecure: boolean;
};

export type BillingPopupBridgeCallbackHandler = (callback: BillingPopupBridgeCallback) => Promise<void> | void;

export function createBillingPopupBridgeCallbackUnsupportedError(): ApiError {
    return new ApiError(BILLING_POPUP_BRIDGE_CALLBACK_UNSUPPORTED_MESSAGE, 0, 501);
}

export function toBillingPopupBridgeCallback(paymentSourceType: string, userId: string, body: BillingPopupBridgeCallbackSchema): BillingPopupBridgeCallback {
    return {
        paymentSourceType,
        userId,
        state: body.state,
        path: body.path,
        query: body.query ? { ...body.query } : undefined,
        insecure: body.insecure ?? false,
    };
}

export function unsupportedBillingPopupBridgeCallbackHandler(): never {
    throw createBillingPopupBridgeCallbackUnsupportedError();
}

export function createBillingPopupBridgeCallbackRouter(callbackHandler: BillingPopupBridgeCallbackHandler = unsupportedBillingPopupBridgeCallbackHandler) {
    const router: Router = createRouter({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Create Billing Popup Bridge Callback",
            description:
                "Completes a third-party billing popup flow after the authenticated client receives the provider redirect. Spacebar does not currently persist popup bridge state or provider callback verification data, so the default implementation fails closed instead of accepting unverifiable payment callbacks.",
            requestBody: "BillingPopupBridgeCallbackSchema",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const { payment_source_type } = req.params as { payment_source_type: string };
            const callback = toBillingPopupBridgeCallback(payment_source_type, req.user_id, req.body as BillingPopupBridgeCallbackSchema);

            await callbackHandler(callback);
            return res.sendStatus(204);
        },
    );

    return router;
}

export default createBillingPopupBridgeCallbackRouter();
