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
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

const paymentSourceTypes = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19"]);

export const BILLING_POPUP_BRIDGE_UNSUPPORTED_MESSAGE = "Billing popup bridge creation is not supported on this Spacebar instance.";
export const INVALID_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_MESSAGE = "Invalid billing popup bridge payment source type.";

export function createBillingPopupBridgeUnsupportedError(): ApiError {
    return new ApiError(BILLING_POPUP_BRIDGE_UNSUPPORTED_MESSAGE, 0, 501);
}

export function createInvalidBillingPopupBridgePaymentSourceTypeError(): ApiError {
    return new ApiError(INVALID_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_MESSAGE, 0, 400);
}

export function assertBillingPopupBridgePaymentSourceType(paymentSourceType: string): void {
    if (!paymentSourceTypes.has(paymentSourceType)) throw createInvalidBillingPopupBridgePaymentSourceTypeError();
}

router.post(
    "/",
    route({
        summary: "Create Billing Popup Bridge",
        description:
            "Creates a third-party billing popup bridge state in Discord. Spacebar does not currently persist provider-backed billing popup bridge state or implement the paired callback flow, so this compatibility endpoint validates the payment source type and fails closed instead of returning an unusable synthetic state token.",
        responses: {
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
    (req: Request, _res: Response) => {
        const { payment_source_type } = req.params as { payment_source_type: string };
        assertBillingPopupBridgePaymentSourceType(payment_source_type);

        throw createBillingPopupBridgeUnsupportedError();
    },
);

export default router;
