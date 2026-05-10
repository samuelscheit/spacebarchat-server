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
import type { OAuthUserInfoResponse } from "@spacebar/schemas";
import { Config, DiscordApiErrors, User } from "@spacebar/util";
import { Request, Response, Router } from "express";

const OPENID_SCOPE = "openid";
const IDENTIFY_SCOPE = "identify";
const EMAIL_SCOPE = "email";
const DEFAULT_LOCALE = "en-US";

type OAuthScopeToken = {
    scope?: unknown;
    scopes?: unknown;
    scp?: unknown;
};

type OAuthUserInfoSource = {
    id: string;
    username?: string;
    avatar?: string | null;
    email?: string | null;
    verified?: boolean;
    settings?: {
        locale?: string | null;
    } | null;
};

export type OAuthUserInfoClaimOptions = {
    includeEmail: boolean;
    includeIdentify: boolean;
};

export type OAuthUserInfoAuthorization = OAuthUserInfoClaimOptions & {
    hasExplicitScopes: boolean;
    hasOpenIdScope: boolean;
};

function scopeValues(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(scopeValues);
    if (typeof value !== "string") return [];

    return value
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

function hasScopeClaim(token: unknown): boolean {
    if (!token || typeof token !== "object") return false;
    return "scope" in token || "scopes" in token || "scp" in token;
}

export function getOAuthScopeValues(token: unknown): string[] {
    if (!token || typeof token !== "object") return [];

    const scopeToken = token as OAuthScopeToken;
    return [...new Set([...scopeValues(scopeToken.scope), ...scopeValues(scopeToken.scopes), ...scopeValues(scopeToken.scp)])];
}

export function getOAuthUserInfoAuthorization(token: unknown): OAuthUserInfoAuthorization {
    const scopes = new Set(getOAuthScopeValues(token));
    const hasExplicitScopes = hasScopeClaim(token);
    const hasOpenIdScope = scopes.has(OPENID_SCOPE);

    if (hasExplicitScopes && !hasOpenIdScope) throw DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE;

    return {
        hasExplicitScopes,
        hasOpenIdScope,
        includeEmail: hasOpenIdScope && scopes.has(EMAIL_SCOPE),
        includeIdentify: hasOpenIdScope && scopes.has(IDENTIFY_SCOPE),
    };
}

function trimTrailingSlashes(value: string) {
    return value.replace(/\/+$/, "");
}

function getDefaultAvatarIndex(userId: string) {
    try {
        return (BigInt(userId) % 6n).toString();
    } catch {
        return "0";
    }
}

export function getOAuthUserInfoPicture(user: Pick<OAuthUserInfoSource, "id" | "avatar">, cdnEndpoint: string) {
    const endpoint = trimTrailingSlashes(cdnEndpoint);
    if (user.avatar) return `${endpoint}/avatars/${user.id}/${user.avatar}.png`;
    return `${endpoint}/embed/avatars/${getDefaultAvatarIndex(user.id)}.png`;
}

export function getOAuthUserInfoFindOptions(userId: string, claims: OAuthUserInfoClaimOptions) {
    const select: Record<string, unknown> = {
        id: true,
    };

    if (claims.includeIdentify) {
        select.username = true;
        select.avatar = true;
        select.settings = {
            locale: true,
        };
    }

    if (claims.includeEmail) {
        select.email = true;
        select.verified = true;
    }

    const options: Record<string, unknown> = {
        where: { id: userId },
        select,
    };

    if (claims.includeIdentify) {
        options.relations = {
            settings: true,
        };
    }

    return options;
}

export function toOAuthUserInfoResponse(user: OAuthUserInfoSource, cdnEndpoint: string, claims: OAuthUserInfoClaimOptions): OAuthUserInfoResponse {
    const response: OAuthUserInfoResponse = {
        sub: user.id,
    };

    if (claims.includeEmail) {
        response.email = user.email ?? null;
        response.email_verified = user.email ? Boolean(user.verified) : false;
    }

    if (claims.includeIdentify) {
        response.preferred_username = user.username ?? "";
        response.nickname = null;
        response.picture = getOAuthUserInfoPicture(user, cdnEndpoint);
        response.locale = user.settings?.locale ?? DEFAULT_LOCALE;
    }

    return response;
}

export function createOAuthUserInfoRouter() {
    const router: Router = Router({ mergeParams: true });

    router.get(
        "/",
        route({
            summary: "Get OpenID User Information",
            responses: {
                200: {
                    body: "OAuthUserInfoResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        }),
        async (req: Request, res: Response) => {
            const claims = getOAuthUserInfoAuthorization(req.token);
            const user = await User.findOneOrFail(getOAuthUserInfoFindOptions(req.user_id, claims));
            const cdnEndpoint = claims.includeIdentify ? Config.get().cdn.endpointPublic! : "";

            return res.json(toOAuthUserInfoResponse(user, cdnEndpoint, claims));
        },
    );

    return router;
}

export default createOAuthUserInfoRouter();
