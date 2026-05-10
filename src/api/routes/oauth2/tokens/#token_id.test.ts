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
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import { DiscordApiErrors } from "@spacebar/util";
import { createOAuth2AuthorizationTokenRouter, deleteOAuth2Authorization, getOAuth2Authorization, isOAuth2AuthorizationTokenId, UNKNOWN_OAUTH2_AUTHORIZATION } from "./#token_id";

const requireModule = require;
const routeModulePath = require.resolve("./#token_id");

afterEach(() => {
    delete require.cache[routeModulePath];
});

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

function setupRouteMetadataHarness(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: Request, _res: Response, next: NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    requireModule(routeModulePath);

    return routeOptions;
}

function createApp(userId = "user-id") {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = userId;
        next();
    });
    app.use("/oauth2/tokens/:token_id", createOAuth2AuthorizationTokenRouter());
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? 400).json({
            code: error.code,
            message: error.message,
        });
    });

    return app;
}

async function requestJson(app: express.Express, requestPath: string, init: { method?: string } = {}) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
            method: init.method,
        });
        const responseText = await response.text();
        const body = responseText ? (JSON.parse(responseText) as unknown) : undefined;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET and DELETE /oauth2/tokens/:token_id", () => {
    test("declares authenticated metadata for the OAuth2 authorization detail route", (t) => {
        assert.deepEqual(setupRouteMetadataHarness(t), [
            {
                responses: {
                    200: {
                        body: "OAuthAuthorizationResponse",
                    },
                    401: {
                        body: "APIErrorResponse",
                    },
                    404: {
                        body: "APIErrorResponse",
                    },
                },
            },
            {
                responses: {
                    204: {},
                    401: {
                        body: "APIErrorResponse",
                    },
                    404: {
                        body: "APIErrorResponse",
                    },
                },
            },
        ]);
    });

    test("validates token IDs as Discord snowflakes", () => {
        assert.equal(isOAuth2AuthorizationTokenId("100000000000000001"), true);
        assert.equal(isOAuth2AuthorizationTokenId("99999999999999999999"), true);
        assert.equal(isOAuth2AuthorizationTokenId(""), false);
        assert.equal(isOAuth2AuthorizationTokenId("123"), false);
        assert.equal(isOAuth2AuthorizationTokenId("0100000000000000001"), false);
        assert.equal(isOAuth2AuthorizationTokenId("not-a-token"), false);
        assert.equal(isOAuth2AuthorizationTokenId("100000000000000001000"), false);
    });

    test("fails closed when OAuth2 authorization grant storage is absent", async () => {
        const tokenId = "100000000000000001";

        assert.equal(await getOAuth2Authorization(tokenId, "user-id"), null);
        assert.equal(await deleteOAuth2Authorization(tokenId, "user-id"), false);
    });

    test("returns 404 unknown token for valid authorization IDs without durable grant storage", async () => {
        const app = createApp();
        const getResponse = await requestJson(app, "/oauth2/tokens/100000000000000001");
        const deleteResponse = await requestJson(app, "/oauth2/tokens/100000000000000001", { method: "DELETE" });

        const expectedBody = {
            code: DiscordApiErrors.UNKNOWN_TOKEN.code,
            message: DiscordApiErrors.UNKNOWN_TOKEN.message,
        };
        assert.deepEqual(getResponse, { status: 404, body: expectedBody });
        assert.deepEqual(deleteResponse, { status: 404, body: expectedBody });
    });

    test("invalid token IDs fail closed with the same unknown token error", async () => {
        const response = await requestJson(createApp(), "/oauth2/tokens/not-a-token");

        assert.deepEqual(response, {
            status: 404,
            body: {
                code: UNKNOWN_OAUTH2_AUTHORIZATION.code,
                message: UNKNOWN_OAUTH2_AUTHORIZATION.message,
            },
        });
    });
});
