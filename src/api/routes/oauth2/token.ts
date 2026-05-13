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
import type { OAuth2TokenErrorCode, OAuth2TokenErrorResponse } from "@spacebar/schemas";
import { urlencoded } from "body-parser";
import { NextFunction, Request, Response, Router } from "express";

export type OAuth2TokenGrantType = "authorization_code" | "refresh_token" | "client_credentials" | "urn:ietf:params:oauth:grant-type:device_code";

export type OAuth2ClientCredentials = {
    client_id: string;
    client_secret?: string;
};

const OAUTH2_TOKEN_FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";
const OAUTH2_TOKEN_UNSUPPORTED_GRANT_DESCRIPTION =
    "Spacebar does not currently persist OAuth2 authorization grants, refresh tokens, device grants, or OAuth2 client secrets required to issue access tokens.";

const oauth2TokenGrantTypes = new Set<OAuth2TokenGrantType>(["authorization_code", "refresh_token", "client_credentials", "urn:ietf:params:oauth:grant-type:device_code"]);
const oauth2TokenFormParser = urlencoded({ extended: false, type: OAUTH2_TOKEN_FORM_CONTENT_TYPE });

export class OAuth2TokenEndpointError extends Error {
    readonly status: number;
    readonly body: OAuth2TokenErrorResponse;

    constructor(status: number, body: OAuth2TokenErrorResponse) {
        super(body.error_description ?? body.error);
        this.status = status;
        this.body = body;
    }
}

export function createOAuth2TokenError(error: OAuth2TokenErrorCode, error_description?: string, status = 400) {
    return new OAuth2TokenEndpointError(status, {
        error,
        ...(error_description ? { error_description } : {}),
    });
}

export function isOAuth2TokenGrantType(value: unknown): value is OAuth2TokenGrantType {
    return typeof value === "string" && oauth2TokenGrantTypes.has(value as OAuth2TokenGrantType);
}

export function isOAuth2TokenFormContentType(value: unknown) {
    if (typeof value !== "string") return false;
    return value.split(";", 1)[0].trim().toLowerCase() === OAUTH2_TOKEN_FORM_CONTENT_TYPE;
}

export function parseOAuth2BasicCredentials(value: unknown): OAuth2ClientCredentials | undefined {
    if (typeof value !== "string") return undefined;

    const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(value.trim());
    if (!match) return undefined;

    let decoded = "";
    try {
        decoded = Buffer.from(match[1], "base64").toString("utf8");
    } catch {
        return undefined;
    }

    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex <= 0) return undefined;

    return {
        client_id: decoded.slice(0, separatorIndex),
        client_secret: decoded.slice(separatorIndex + 1),
    };
}

export function getOAuth2FormField(body: unknown, field: string): string | undefined {
    if (!body || typeof body !== "object") return undefined;

    const value = (body as Record<string, unknown>)[field];
    if (value === undefined) return undefined;
    if (typeof value === "string") return value.trim();

    throw createOAuth2TokenError("invalid_request", `The ${field} form field must be provided exactly once.`);
}

export function getOAuth2ClientCredentials(req: Request): OAuth2ClientCredentials | undefined {
    const basicCredentials = parseOAuth2BasicCredentials(req.headers.authorization);
    if (basicCredentials) return basicCredentials;

    const client_id = getOAuth2FormField(req.body, "client_id");
    if (!client_id) return undefined;

    const client_secret = getOAuth2FormField(req.body, "client_secret");

    return {
        client_id,
        ...(client_secret !== undefined ? { client_secret } : {}),
    };
}

export function getOAuth2TokenGrantError(body: unknown) {
    const grantType = getOAuth2FormField(body, "grant_type");
    if (!grantType) return createOAuth2TokenError("invalid_request", "The grant_type form field is required.");

    if (!isOAuth2TokenGrantType(grantType)) return createOAuth2TokenError("unsupported_grant_type", `Unsupported OAuth2 grant_type: ${grantType}`);

    return createOAuth2TokenError("unsupported_grant_type", OAUTH2_TOKEN_UNSUPPORTED_GRANT_DESCRIPTION);
}

export function getOAuth2TokenRequestError(req: Request) {
    getOAuth2ClientCredentials(req);
    return getOAuth2TokenGrantError(req.body);
}

export function sendOAuth2TokenError(res: Response, error: OAuth2TokenEndpointError) {
    return res.status(error.status).json(error.body);
}

function requireOAuth2TokenFormContentType(req: Request, res: Response, next: NextFunction) {
    if (isOAuth2TokenFormContentType(req.headers["content-type"])) return next();

    return sendOAuth2TokenError(res, createOAuth2TokenError("invalid_request", `OAuth2 token requests must use ${OAUTH2_TOKEN_FORM_CONTENT_TYPE}.`));
}

function parseOAuth2TokenForm(req: Request, res: Response, next: NextFunction) {
    oauth2TokenFormParser(req, res, (error) => {
        if (error) return sendOAuth2TokenError(res, createOAuth2TokenError("invalid_request", "Invalid OAuth2 token form body."));
        return next();
    });
}

export function createOAuth2TokenRouter() {
    const router = Router({ mergeParams: true });

    router.post(
        "/",
        requireOAuth2TokenFormContentType,
        parseOAuth2TokenForm,
        route({
            summary: "Get OAuth2 Token",
            responses: {
                200: {
                    body: "OAuth2TokenResponse",
                },
                400: {
                    body: "OAuth2TokenErrorResponse",
                },
            },
        }),
        (req: Request, res: Response) => {
            try {
                return sendOAuth2TokenError(res, getOAuth2TokenRequestError(req));
            } catch (error) {
                if (error instanceof OAuth2TokenEndpointError) return sendOAuth2TokenError(res, error);
                throw error;
            }
        },
    );

    return router;
}

export default createOAuth2TokenRouter();
