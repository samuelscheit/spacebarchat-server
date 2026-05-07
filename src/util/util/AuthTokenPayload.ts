/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors
	SPDX-License-Identifier: AGPL-3.0-only
*/

import { getTokenUserId, type TokenPayload } from "./TokenPayload";

export type AccessTokenPayload = TokenPayload & {
    typ?: "access";
};

export function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
    if (!value || typeof value !== "object") return false;
    const payload = value as Partial<TokenPayload> & { typ?: unknown };
    if (payload.typ !== undefined && payload.typ !== "access") return false;
    return typeof payload.iat === "number" && typeof getTokenUserId(payload as TokenPayload) === "string";
}
