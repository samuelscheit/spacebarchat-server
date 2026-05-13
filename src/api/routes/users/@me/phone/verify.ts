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
import { type UserPhoneVerifyNoPasswordResponse, type UserPhoneVerifyNoPasswordSchema } from "@spacebar/schemas";
import { ApiError } from "@spacebar/util";
import { Request, Response, Router } from "express";

export const USER_PHONE_VERIFY_NO_PASSWORD_UNSUPPORTED_MESSAGE = "Phone verification without password is not supported on this Spacebar instance.";

export interface UserPhoneVerifyNoPasswordContext {
    fingerprint?: string;
    ip?: string;
    userAgent?: string;
}

export interface UserPhoneVerifyNoPasswordDependencies {
    verifyCurrentUserPhoneCode(userId: string, phone: string, code: string, context: UserPhoneVerifyNoPasswordContext): Promise<UserPhoneVerifyNoPasswordResponse>;
}

export function createUserPhoneVerifyNoPasswordUnsupportedError(): ApiError {
    return new ApiError(USER_PHONE_VERIFY_NO_PASSWORD_UNSUPPORTED_MESSAGE, 0, 501);
}

const defaultUserPhoneVerifyNoPasswordDependencies: UserPhoneVerifyNoPasswordDependencies = {
    async verifyCurrentUserPhoneCode() {
        // Discord verifies an SMS code and returns a phone token here. Spacebar
        // has no durable phone verification token store or SMS provider, so the
        // route fails closed unless an instance wires a real verifier.
        throw createUserPhoneVerifyNoPasswordUnsupportedError();
    },
};

function getUserPhoneVerifyNoPasswordContext(req: Request): UserPhoneVerifyNoPasswordContext {
    return {
        fingerprint: req.fingerprint,
        ip: req.ip,
        userAgent: req.get("user-agent"),
    };
}

export function createUserPhoneVerifyNoPasswordRouter(dependencies: UserPhoneVerifyNoPasswordDependencies = defaultUserPhoneVerifyNoPasswordDependencies) {
    const router: Router = Router({ mergeParams: true });

    router.post(
        "/",
        route({
            summary: "Verify Current User Phone Number Without Password",
            description:
                "Verifies a phone SMS code and returns a phone token when a real phone verification token store and SMS provider are configured. The default Spacebar instance has neither, so it fails closed with 501 instead of accepting or minting phone tokens locally.",
            requestBody: "UserPhoneVerifyNoPasswordSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "UserPhoneVerifyNoPasswordResponse",
                },
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
            const body = req.body as UserPhoneVerifyNoPasswordSchema;
            const response = await dependencies.verifyCurrentUserPhoneCode(req.user_id, body.phone, body.code, getUserPhoneVerifyNoPasswordContext(req));

            return res.json(response);
        },
    );

    return router;
}

export default createUserPhoneVerifyNoPasswordRouter();
