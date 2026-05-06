/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors
	SPDX-License-Identifier: AGPL-3.0-only
*/

/// Change history:
/// 1 - Initial version with HS256
/// 2 - Switched to ES512
/// 3 - Add version, device id to token payload
/// 4 - Add explicit access token type
export const CurrentTokenFormatVersion: number = 4;

export type AccessTokenPayload = {
    id: string;
    iat: number;
    typ: "access";
    // token format version
    ver?: number;
    // device id
    did?: string;
};

export function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as Partial<AccessTokenPayload>;
    return payload.typ === "access" && typeof payload.id === "string" && typeof payload.iat === "number" && typeof payload.did === "string";
}
