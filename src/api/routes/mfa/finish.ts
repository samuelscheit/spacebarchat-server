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

import { createRecentMfaCookie, generateRecentMfaToken, route, verifyMfaTicketFromRequest, verifyTotpOrBackupCode } from "@spacebar/api";
import { MfaFinishSchema } from "@spacebar/schemas";
import { User } from "@spacebar/util";
import bcrypt from "bcrypt";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router = Router({ mergeParams: true });

router.post(
    "/",
    route({
        requestBody: "MfaFinishSchema",
        responses: {
            200: {
                body: "TokenOnlyResponse",
            },
            400: {
                body: "APIErrorResponse",
            },
            404: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const body = req.body as MfaFinishSchema;
        const ticket = await verifyMfaTicketFromRequest(body.ticket);
        if (!ticket) throw new HTTPError("Invalid MFA ticket", 60008);

        const user = await User.findOneOrFail({
            where: { id: ticket.user_id },
            select: { id: true, data: true, totp_secret: true },
        });

        let verified = false;
        if (body.mfa_type === "password") {
            verified = await bcrypt.compare(body.data, user.data.hash || "");
        } else if (body.mfa_type === "totp") {
            verified = await verifyTotpOrBackupCode(user.id, user.totp_secret, body.data);
        }

        if (!verified) throw new HTTPError(req.t("auth:login.INVALID_TOTP_CODE"), 60008);

        const token = await generateRecentMfaToken({
            userId: user.id,
            action: ticket.action,
            sessionId: ticket.session_id,
        });
        res.setHeader("Set-Cookie", createRecentMfaCookie(token));
        return res.json({ token });
    },
);

export default router;
