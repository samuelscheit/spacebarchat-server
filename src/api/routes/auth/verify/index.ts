/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import { route, verifyCaptcha } from "@spacebar/api";
import { Config, EmailActionTokenPurpose, FieldErrors, User, verifyEmailActionToken } from "@spacebar/util";
import { Request, Response, Router } from "express";
const router = Router({ mergeParams: true });

// TODO: the response interface also returns settings, but this route doesn't actually return that.
router.post(
    "/",
    route({
        requestBody: "VerifyEmailSchema",
        responses: {
            204: {},
            400: {
                body: "APIErrorOrCaptchaResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { captcha_key, token } = req.body;

        const config = Config.get();

        if (config.register.requireCaptcha && config.security.captcha.enabled) {
            const { sitekey, service } = config.security.captcha;

            if (!captcha_key) {
                return res.status(400).json({
                    captcha_key: ["captcha-required"],
                    captcha_sitekey: sitekey,
                    captcha_service: service,
                });
            }

            const ip = req.ip;
            const verify = await verifyCaptcha(captcha_key, ip);
            if (!verify.success) {
                return res.status(400).json({
                    captcha_key: verify["error-codes"],
                    captcha_sitekey: sitekey,
                    captcha_service: service,
                });
            }
        }

        let user;

        try {
            user = await verifyEmailActionToken(token, EmailActionTokenPurpose.verifyEmail);
        } catch {
            throw FieldErrors({
                token: {
                    message: req.t("auth:password_reset.INVALID_TOKEN"),
                    code: "INVALID_TOKEN",
                },
            });
        }

        if (user.verified) {
            throw FieldErrors({
                token: {
                    message: req.t("auth:password_reset.INVALID_TOKEN"),
                    code: "INVALID_TOKEN",
                },
            });
        }

        await User.update({ id: user.id }, { verified: true });

        return res.sendStatus(204);
    },
);

export default router;
