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

export const ADYEN_PAYMENT_METHODS_UNSUPPORTED_MESSAGE = "Adyen payment method discovery is not supported on this Spacebar instance.";

export function createAdyenPaymentMethodsUnsupportedError(): ApiError {
    return new ApiError(ADYEN_PAYMENT_METHODS_UNSUPPORTED_MESSAGE, 0, 501);
}

export function createUserBillingAdyenPaymentMethodsRouter() {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Available Adyen Payment Methods",
            description:
                "Discord's endpoint proxies Adyen Checkout paymentMethods. Spacebar has no Adyen merchant integration or payment-method discovery state, so this compatibility endpoint fails closed instead of fabricating provider availability.",
            responses: {
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        (_req: Request, _res: Response) => {
            throw createAdyenPaymentMethodsUnsupportedError();
        },
    );

    return router;
}

export default createUserBillingAdyenPaymentMethodsRouter();
