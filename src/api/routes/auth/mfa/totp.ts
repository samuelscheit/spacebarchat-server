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

import { assertMfaCode, consumeMfaBackupCode, createTokenResponse, route, verifyLoginMfaTicketFromRequest } from "@spacebar/api";
import { User } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { TotpSchema } from "@spacebar/schemas";
const router = Router({ mergeParams: true });

router.post(
    "/",
    route({
        requestBody: "TotpSchema",
        responses: {
            200: {
                body: "TokenResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
        },
        spacebarOnly: false, // not part of public openapi
    }),
    async (req: Request, res: Response) => {
        // const { code, ticket, gift_code_sku_id, login_source } =
        const { code, ticket } = req.body as TotpSchema;

        const user = await User.findOneOrFail({
            where: {
                totp_last_ticket: ticket,
            },
            select: { id: true, totp_secret: true },
        }).catch(() => {
            throw new HTTPError(req.t("auth:login.INVALID_TOTP_CODE"), 60008);
        });

        if (!(await verifyLoginMfaTicketFromRequest(ticket, user.id))) {
            throw new HTTPError(req.t("auth:login.INVALID_TOTP_CODE"), 60008);
        }

        await assertMfaCode({
            code,
            mfa_enabled: true,
            totp_secret: user.totp_secret,
            invalidCodeError: () => new HTTPError(req.t("auth:login.INVALID_TOTP_CODE"), 60008),
            consumeBackupCode: (code) => consumeMfaBackupCode({ code, userId: user.id }),
        });

        await User.update({ id: user.id }, { totp_last_ticket: "" });

        return res.json(await createTokenResponse(user.id));
    },
);

export default router;
