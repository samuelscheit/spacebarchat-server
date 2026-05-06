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

import { Request } from "express";
import type { ExpectedAssertionResult, ExpectedAttestationResult } from "fido2-lib";
import type { WebAuthnTicketPayload, WebAuthnTicketPurpose } from "../../../util/util/WebAuthn";

export type WebAuthnAssertionSecurityKey = {
    key_id: string;
    public_key: string;
    counter: number;
};

export function toArrayBuffer(buf: Buffer) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}

export function getWebAuthnExpectedOrigin(req: Request, configuredEndpoint?: string | null) {
    if (configuredEndpoint) return new URL(configuredEndpoint).origin;

    const protocol = req.protocol;
    const host = req.get("host") || req.hostname;

    return new URL(`${protocol}://${host}`).origin;
}

export function getWebAuthnExpectedRpId(origin: string) {
    return new URL(origin).hostname;
}

export function encodeWebAuthnChallenge(challenge: ArrayBuffer | Buffer) {
    return Buffer.from(challenge instanceof ArrayBuffer ? new Uint8Array(challenge) : challenge).toString("base64url");
}

export function encodeWebAuthnClientChallenge(challenge: ArrayBuffer | Buffer) {
    return Buffer.from(challenge instanceof ArrayBuffer ? new Uint8Array(challenge) : challenge).toString("base64");
}

export function buildWebAuthnTicketPayload(
    req: Request,
    challenge: ArrayBuffer | Buffer,
    userId: string,
    purpose: WebAuthnTicketPurpose,
    configuredEndpoint?: string | null,
    allowCredentialIds?: string[],
): WebAuthnTicketPayload {
    const origin = getWebAuthnExpectedOrigin(req, configuredEndpoint);

    return {
        challenge: encodeWebAuthnChallenge(challenge),
        origin,
        rpId: getWebAuthnExpectedRpId(origin),
        user_id: userId,
        purpose,
        allowCredentialIds,
    };
}

export function isWebAuthnTicketForUser(payload: WebAuthnTicketPayload, userId: string, purpose: WebAuthnTicketPurpose) {
    return (
        payload.user_id === userId &&
        payload.purpose === purpose &&
        typeof payload.origin === "string" &&
        typeof payload.rpId === "string" &&
        (purpose !== "login_mfa" || Array.isArray(payload.allowCredentialIds))
    );
}

export function parseWebAuthnCredentialResponse(serializedCredential: string) {
    const credential = JSON.parse(serializedCredential);

    if (!credential.rawId) return null;

    const rawIdBuffer = Buffer.from(credential.rawId, "base64url");
    credential.rawId = toArrayBuffer(rawIdBuffer);

    return {
        credential,
        keyId: rawIdBuffer.toString("base64"),
    };
}

export function webAuthnSecurityKeyLookup(userId: string, keyId: string) {
    return {
        key_id: keyId,
        user_id: userId,
    };
}

export function webAuthnAllowCredentials(keyIds: string[] | undefined) {
    return keyIds?.map((keyId) => ({
        id: toArrayBuffer(Buffer.from(keyId, "base64")),
        type: "public-key" as const,
    }));
}

export function isWebAuthnCredentialAllowed(payload: WebAuthnTicketPayload, keyId: string) {
    return Array.isArray(payload.allowCredentialIds) && payload.allowCredentialIds.includes(keyId);
}

export function webAuthnLoginMfaSecurityKeyLookup(payload: WebAuthnTicketPayload, userId: string, keyId: string) {
    if (!isWebAuthnTicketForUser(payload, userId, "login_mfa") || !isWebAuthnCredentialAllowed(payload, keyId)) return null;

    return webAuthnSecurityKeyLookup(userId, keyId);
}

export function buildWebAuthnAssertionExpectations(payload: WebAuthnTicketPayload, securityKey: WebAuthnAssertionSecurityKey): ExpectedAssertionResult {
    return {
        challenge: payload.challenge,
        origin: payload.origin!,
        rpId: payload.rpId,
        factor: "second",
        publicKey: securityKey.public_key,
        prevCounter: securityKey.counter,
        userHandle: null,
        allowCredentials: webAuthnAllowCredentials(payload.allowCredentialIds),
    };
}

export function buildWebAuthnAttestationExpectations(payload: WebAuthnTicketPayload): ExpectedAttestationResult {
    return {
        challenge: payload.challenge,
        origin: payload.origin!,
        rpId: payload.rpId,
        factor: "second",
    };
}
