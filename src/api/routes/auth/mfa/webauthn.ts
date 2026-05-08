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

import {
    buildWebAuthnAssertionExpectations,
    createTokenResponse,
    isWebAuthnTicketForUser,
    parseWebAuthnCredentialResponse,
    route,
    webAuthnLoginMfaSecurityKeyLookup,
} from "@spacebar/api";
import { isWebAuthnTicketPayload, SecurityKey, User, verifyWebAuthnToken, WebAuthn } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { WebAuthnTotpSchema } from "@spacebar/schemas";
const router = Router({ mergeParams: true });

router.post(
    "/",
    route({
        requestBody: "WebAuthnTotpSchema",
        responses: {
            200: { body: "TokenResponse" },
            400: { body: "APIErrorResponse" },
        },
        spacebarOnly: false, // not part of public openapi
    }),
    async (req: Request, res: Response) => {
        if (!WebAuthn.fido2) {
            // TODO: I did this for typescript and I can't use !
            throw new Error("WebAuthn not enabled");
        }

        const { code, ticket } = req.body as WebAuthnTotpSchema;

        const user = await User.findOneOrFail({
            where: {
                totp_last_ticket: ticket,
            },
            select: { id: true },
        });

        let verified: unknown;
        try {
            verified = await verifyWebAuthnToken(ticket);
        } catch {
            throw new HTTPError(req.t("auth:login.INVALID_TOTP_CODE"), 60008);
        }

        if (!isWebAuthnTicketPayload(verified) || !isWebAuthnTicketForUser(verified, user.id, "login_mfa")) {
            throw new HTTPError(req.t("auth:login.INVALID_TOTP_CODE"), 60008);
        }

        const parsedCredential = parseWebAuthnCredentialResponse(code);
        if (!parsedCredential) throw new HTTPError("Missing rawId", 400);

        const securityKeyLookup = webAuthnLoginMfaSecurityKeyLookup(verified, user.id, parsedCredential.keyId);
        if (!securityKeyLookup) {
            throw new HTTPError(req.t("auth:login.INVALID_TOTP_CODE"), 60008);
        }

        const securityKey = await SecurityKey.findOneOrFail({
            where: securityKeyLookup,
        });

        const authnResult = await WebAuthn.fido2.assertionResult(parsedCredential.credential, buildWebAuthnAssertionExpectations(verified, securityKey));

        const counter = authnResult.authnrData.get("counter");

        securityKey.counter = counter;

        await securityKey.save();
        await User.update({ id: user.id }, { totp_last_ticket: "" });

        return res.json(await createTokenResponse(user.id));
    },
);

export default router;
