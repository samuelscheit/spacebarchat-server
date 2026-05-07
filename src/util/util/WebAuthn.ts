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

import { Fido2Lib } from "fido2-lib";
import jwt from "jsonwebtoken";
import { loadOrGenerateKeypair } from "./Token";

const jwtSignOptions: jwt.SignOptions = {
    algorithm: "ES512",
    expiresIn: "5m",
};
const jwtVerifyOptions: jwt.VerifyOptions = {
    algorithms: ["ES512"],
};

export const WebAuthn: {
    fido2: Fido2Lib | null;
    init: () => void;
} = {
    fido2: null,
    init: function () {
        this.fido2 = new Fido2Lib({
            challengeSize: 128,
        });
    },
};

export type WebAuthnTicketPurpose = "login_mfa" | "credential_registration";

export type WebAuthnTicketPayload = {
    challenge: string;
    user_id?: string;
    origin?: string;
    rpId?: string;
    purpose?: WebAuthnTicketPurpose;
    allowCredentialIds?: string[];
};

export function isWebAuthnTicketPayload(value: unknown): value is WebAuthnTicketPayload {
    if (!value || typeof value !== "object") return false;

    const payload = value as Record<string, unknown>;

    return (
        typeof payload.challenge === "string" &&
        (payload.user_id === undefined || typeof payload.user_id === "string") &&
        (payload.origin === undefined || typeof payload.origin === "string") &&
        (payload.rpId === undefined || typeof payload.rpId === "string") &&
        (payload.purpose === undefined || payload.purpose === "login_mfa" || payload.purpose === "credential_registration") &&
        (payload.allowCredentialIds === undefined || (Array.isArray(payload.allowCredentialIds) && payload.allowCredentialIds.every((id) => typeof id === "string")))
    );
}

export async function generateWebAuthnTicket(challengeOrPayload: string | WebAuthnTicketPayload): Promise<string> {
    const payload = typeof challengeOrPayload === "string" ? { challenge: challengeOrPayload } : challengeOrPayload;

    return new Promise((res, rej) => {
        loadOrGenerateKeypair().then((kp) =>
            jwt.sign(payload, kp.privateKey, jwtSignOptions, (err, token) => {
                if (err || !token) return rej(err || "no token");
                return res(token);
            }),
        );
    });
}

export async function verifyWebAuthnToken(token: string): Promise<unknown> {
    return new Promise((res, rej) => {
        loadOrGenerateKeypair().then((kp) =>
            jwt.verify(token, kp.publicKey, jwtVerifyOptions, (err, decoded) => {
                if (err) return rej(err);
                return res(decoded);
            }),
        );
    });
}
