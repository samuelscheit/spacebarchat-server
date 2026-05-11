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

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import {
    createOAuthCurrentAuthorizationRouter,
    getOAuthCurrentAuthorizationApplicationId,
    getOAuthCurrentAuthorizationClaims,
    getOAuthCurrentAuthorizationResponse,
    getOAuthCurrentAuthorizationScopes,
    type OAuthCurrentAuthorizationApplicationRepository,
    type OAuthCurrentAuthorizationUserRepository,
} from "./@me";

const requireModule = require;
const routeModulePath = require.resolve("./@me");

const APPLICATION_ID = "100000000000000001";
const USER_ID = "100000000000000002";
const EXPIRES = "2026-05-12T10:00:00.000Z";
const NOW = new Date("2026-05-11T10:00:00.000Z");
const EXP = Math.floor(Date.parse(EXPIRES) / 1000);

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /oauth2/@me", () => {
    test("declares OAuth2 current authorization route metadata", (t) => {
        const routeOptions = setupRouteMetadataHarness(t);

        assert.deepEqual(routeOptions, [
            {
                summary: "Get Current Authorization Information",
                responses: {
                    200: {
                        body: "OAuthCurrentAuthorizationResponse",
                    },
                    400: {
                        body: "APIErrorResponse",
                    },
                    401: {
                        body: "APIErrorResponse",
                    },
                },
            },
        ]);
    });

    test("extracts application, scopes, and expiry from OAuth token claims", () => {
        const token = {
            application: { id: APPLICATION_ID },
            scope: "identify guilds",
            scopes: ["guilds.members.read", "identify"],
            exp: EXP,
        };

        assert.equal(getOAuthCurrentAuthorizationApplicationId(token), APPLICATION_ID);
        assert.deepEqual(getOAuthCurrentAuthorizationScopes(token), ["identify", "guilds", "guilds.members.read"]);
        assert.deepEqual(getOAuthCurrentAuthorizationClaims(token, NOW), {
            applicationId: APPLICATION_ID,
            scopes: ["identify", "guilds", "guilds.members.read"],
            expires: new Date(EXPIRES),
            includeUser: true,
        });
    });

    test("rejects normal session tokens and malformed OAuth token claims", () => {
        assert.throws(() => getOAuthCurrentAuthorizationClaims({ sub: USER_ID, iat: 1778493600 }, NOW), DiscordApiErrors.INVALID_OAUTH_TOKEN);
        assert.throws(() => getOAuthCurrentAuthorizationClaims({ client_id: APPLICATION_ID, exp: EXP }, NOW), DiscordApiErrors.INVALID_OAUTH_TOKEN);
        assert.throws(() => getOAuthCurrentAuthorizationClaims({ client_id: "not-a-snowflake", scope: "identify", exp: EXP }, NOW), DiscordApiErrors.INVALID_OAUTH_TOKEN);
        assert.throws(
            () => getOAuthCurrentAuthorizationClaims({ client_id: APPLICATION_ID, scope: "identify", exp: Math.floor(NOW.getTime() / 1000) }, NOW),
            DiscordApiErrors.INVALID_OAUTH_TOKEN,
        );
    });

    test("returns the current authorization and user for identify-scoped OAuth tokens", async () => {
        const response = await getOAuthCurrentAuthorizationResponse({ client_id: APPLICATION_ID, scope: "identify guilds", exp: EXP }, USER_ID, {
            applicationRepository: applicationRepository(),
            userRepository: userRepository(),
            now: () => NOW,
        });

        assert.deepEqual(response, {
            application: {
                id: APPLICATION_ID,
                name: "Example App",
                icon: null,
                description: "Example application",
                summary: "",
                type: null,
                hook: true,
                bot_public: true,
                bot_require_code_grant: false,
                verify_key: "verify-key",
                owner: publicUser("owner-id", "owner"),
                flags: 0,
                bot: publicUser("bot-id", "bot", true),
            },
            scopes: ["identify", "guilds"],
            expires: EXPIRES,
            user: publicUser(USER_ID, "alice"),
        });
    });

    test("omits user when the current authorization lacks identify scope", async () => {
        const response = await getOAuthCurrentAuthorizationResponse({ client_id: APPLICATION_ID, scope: "guilds", expires: EXPIRES }, USER_ID, {
            applicationRepository: applicationRepository(),
            userRepository: {
                async findOneOrFail() {
                    throw new Error("user repository should not be called without identify scope");
                },
            },
            now: () => NOW,
        });

        assert.equal("user" in response, false);
        assert.deepEqual(response.scopes, ["guilds"]);
    });

    test("returns invalid OAuth token errors for session tokens over HTTP", async () => {
        const harness = setupHttpHarness({
            token: { sub: USER_ID, iat: 1778493600 },
        });

        const response = await requestJson(harness.app, "/oauth2/@me");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.INVALID_OAUTH_TOKEN.code,
            message: DiscordApiErrors.INVALID_OAUTH_TOKEN.message,
        });
    });
});

function setupRouteMetadataHarness(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    requireModule(routeModulePath);

    return routeOptions;
}

function publicUser(id: string, username: string, bot = false) {
    return {
        id,
        username,
        discriminator: "0001",
        avatar: null,
        public_flags: 0,
        bot,
    } as never;
}

function applicationRepository(): OAuthCurrentAuthorizationApplicationRepository {
    return {
        async findOne() {
            return {
                id: APPLICATION_ID,
                name: "Example App",
                icon: null,
                description: "Example application",
                summary: "",
                type: null,
                hook: true,
                bot_public: true,
                bot_require_code_grant: false,
                verify_key: "verify-key",
                flags: 0,
                owner: publicUser("owner-id", "owner"),
                bot: publicUser("bot-id", "bot", true),
            };
        },
    };
}

function userRepository(): OAuthCurrentAuthorizationUserRepository {
    return {
        async findOneOrFail() {
            return publicUser(USER_ID, "alice");
        },
    };
}

function setupHttpHarness(options: { token: Record<string, unknown> }) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = USER_ID;
        req.token = options.token as never;
        next();
    });
    app.use(
        "/oauth2/@me",
        createOAuthCurrentAuthorizationRouter({
            applicationRepository: applicationRepository(),
            userRepository: userRepository(),
            now: () => NOW,
        }),
    );
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({
            code: error.code,
            message: error.message,
        });
    });

    return { app };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
