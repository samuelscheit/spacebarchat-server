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
import type { PaymentInvoiceBreakdownResponse, Snowflake } from "@spacebar/schemas";
import { ApiError, DiscordApiErrors } from "@spacebar/util";
import { Router as createRouter, type Request, type Response, type Router } from "express";

const paymentIdPattern = /^[1-9]\d{16,19}$/;

export const UNKNOWN_BILLING_PAYMENT = new ApiError("Unknown payment", 0, 404);

export type PaymentInvoiceBreakdownProvider = (paymentId: Snowflake, userId: string) => PaymentInvoiceBreakdownResponse | null | Promise<PaymentInvoiceBreakdownResponse | null>;

function firstQueryValue(value: unknown): unknown {
    if (Array.isArray(value)) return firstQueryValue(value[0]);
    return value;
}

function queryString(value: unknown): string | undefined {
    const entry = firstQueryValue(value);
    return typeof entry === "string" && entry.length > 0 ? entry : undefined;
}

export function isPaymentInvoiceBreakdownPaymentId(value: unknown): value is Snowflake {
    return typeof value === "string" && paymentIdPattern.test(value);
}

export function parsePaymentInvoiceBreakdownQuery(query: Request["query"]): Snowflake {
    const paymentId = queryString(query.payment_id);
    if (!isPaymentInvoiceBreakdownPaymentId(paymentId)) throw DiscordApiErrors.INVALID_FORM_BODY;

    return paymentId;
}

export async function getPaymentInvoiceBreakdown(paymentId: Snowflake, userId: string): Promise<PaymentInvoiceBreakdownResponse | null> {
    void paymentId;
    void userId;

    // Spacebar does not persist Discord billing payments or provider invoice URLs yet.
    return null;
}

export function createUserBillingInvoiceBreakdownRouter(invoiceProvider: PaymentInvoiceBreakdownProvider = getPaymentInvoiceBreakdown) {
    const router: Router = createRouter({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get Payment Invoice Breakdown",
            description:
                "Returns invoice download URLs for a current-user payment when locally persisted billing-provider invoice state exists. Spacebar does not currently persist Discord billing payments or provider invoice URLs, so unknown payments fail closed instead of fabricating invoice links.",
            query: {
                payment_id: {
                    type: "string",
                    required: true,
                    description: "Payment ID to retrieve invoice download URLs for.",
                },
            },
            responses: {
                200: {
                    body: "PaymentInvoiceBreakdownResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const paymentId = parsePaymentInvoiceBreakdownQuery(req.query);
            const breakdown = await invoiceProvider(paymentId, req.user_id);
            if (!breakdown) throw UNKNOWN_BILLING_PAYMENT;

            return res.status(200).json(breakdown);
        },
    );

    return router;
}

export default createUserBillingInvoiceBreakdownRouter();
