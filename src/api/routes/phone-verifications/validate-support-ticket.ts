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
import { type PhoneVerificationSupportTicketValidateSchema } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const PHONE_SUPPORT_TICKET_VALIDATION_UNSUPPORTED_MESSAGE = "Phone verification support-ticket validation is not supported on this Spacebar instance.";

export interface PhoneSupportTicketValidationContext {
    fingerprint?: string;
    ip?: string;
    userAgent?: string;
}

export interface PhoneSupportTicketValidationDependencies {
    validatePhoneSupportTicket(userId: string, token: string, context: PhoneSupportTicketValidationContext): Promise<void>;
}

export function createPhoneSupportTicketValidationUnsupportedError(): ApiError {
    return new ApiError(PHONE_SUPPORT_TICKET_VALIDATION_UNSUPPORTED_MESSAGE, 0, 501);
}

const defaultPhoneSupportTicketValidationDependencies: PhoneSupportTicketValidationDependencies = {
    async validatePhoneSupportTicket() {
        // Discord consumes a phone-verification support-ticket token here.
        // Spacebar has no durable phone verification token store or support-ticket
        // backend, so the route fails closed unless an instance wires one.
        throw createPhoneSupportTicketValidationUnsupportedError();
    },
};

function getPhoneSupportTicketValidationContext(req: Request): PhoneSupportTicketValidationContext {
    return {
        fingerprint: req.fingerprint,
        ip: req.ip,
        userAgent: req.get("user-agent"),
    };
}

export function createPhoneSupportTicketValidationRouter(dependencies: PhoneSupportTicketValidationDependencies = defaultPhoneSupportTicketValidationDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Validate Phone Verification Support Ticket",
            description:
                "Validates a phone-verification support-ticket token when a real phone verification token store and support-ticket backend are configured. The default Spacebar instance has neither, so it fails closed with 501 instead of accepting opaque support-ticket tokens.",
            requestBody: "PhoneVerificationSupportTicketValidateSchema",
            coerceRequestBody: false,
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
            const body = req.body as PhoneVerificationSupportTicketValidateSchema;

            await dependencies.validatePhoneSupportTicket(req.user_id, body.token, getPhoneSupportTicketValidationContext(req));

            return res.sendStatus(204);
        },
    );

    return router;
}

export default createPhoneSupportTicketValidationRouter();
