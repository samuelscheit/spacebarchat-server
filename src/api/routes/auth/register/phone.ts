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
import { type RegisterPhoneSchema } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const REGISTER_PHONE_UNSUPPORTED_MESSAGE = "Phone registration verification codes are not supported on this Spacebar instance.";

export interface RegisterPhoneRequestContext {
    fingerprint?: string;
    ip?: string;
    userAgent?: string;
}

export interface RegisterPhoneDependencies {
    sendRegistrationPhoneVerificationCode(phone: string, context: RegisterPhoneRequestContext): Promise<void>;
}

export function createRegisterPhoneUnsupportedError(): ApiError {
    return new ApiError(REGISTER_PHONE_UNSUPPORTED_MESSAGE, 0, 501);
}

const defaultRegisterPhoneDependencies: RegisterPhoneDependencies = {
    async sendRegistrationPhoneVerificationCode() {
        // Discord sends an SMS registration code here. Spacebar has no durable
        // phone verification token store or SMS provider, so the public route
        // fails closed unless an instance wires a real sender.
        throw createRegisterPhoneUnsupportedError();
    },
};

function getRegisterPhoneRequestContext(req: Request): RegisterPhoneRequestContext {
    return {
        fingerprint: req.fingerprint,
        ip: req.ip,
        userAgent: req.get("user-agent"),
    };
}

export function createRegisterPhoneRouter(dependencies: RegisterPhoneDependencies = defaultRegisterPhoneDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Register Account with Phone Number",
            description:
                "Sends a registration phone verification code when a real SMS provider is configured. The default Spacebar instance has no phone verification token store or SMS provider, so it fails closed with 501 instead of pretending a code was sent.",
            requestBody: "RegisterPhoneSchema",
            coerceRequestBody: false,
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const body = req.body as RegisterPhoneSchema;

            await dependencies.sendRegistrationPhoneVerificationCode(body.phone, getRegisterPhoneRequestContext(req));

            return res.sendStatus(204);
        },
    );

    return router;
}

export default createRegisterPhoneRouter();
