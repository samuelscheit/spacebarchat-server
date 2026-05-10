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
import { Config } from "@spacebar/util";
import { PasswordValidateResponse, PasswordValidateSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { calculatePasswordStrength, validatePasswordPolicy, type PasswordStrengthPolicy } from "../../../util/utility/passwordStrength";

export const MAX_PASSWORD_STRENGTH_SCORE = 4;

const router: Router = Router({ mergeParams: true });

export default router;

export function passwordStrengthScore(password: string, policy: PasswordStrengthPolicy = Config.get().register.password): number {
    const rawScore = Math.round(calculatePasswordStrength(password, policy) * MAX_PASSWORD_STRENGTH_SCORE);

    return Math.min(MAX_PASSWORD_STRENGTH_SCORE, Math.max(0, rawScore));
}

export function buildPasswordValidateResponse(password: string, policy: PasswordStrengthPolicy = Config.get().register.password): PasswordValidateResponse {
    return {
        valid: !validatePasswordPolicy(password, policy),
        password_strength: passwordStrengthScore(password, policy),
    };
}

router.post(
    "/",
    route({
        summary: "Get Password Strength",
        requestBody: "PasswordValidateSchema",
        coerceRequestBody: false,
        responses: {
            200: {
                body: "PasswordValidateResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
        },
    }),
    (req: Request, res: Response) => {
        const body = req.body as PasswordValidateSchema;

        return res.json(buildPasswordValidateResponse(body.password));
    },
);
