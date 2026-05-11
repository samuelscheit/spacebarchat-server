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
import lobbyMessagesRouter, { assertLobbyWriteOAuthScope, getLobbyMessages, getLobbyMessagesForRequest, hasLobbyWriteOAuthScope, parseLobbyMessagesLimit } from "./messages";
import { UNKNOWN_LOBBY } from "../../../util/utility/Lobbies";

const requireModule = require;
const routeModulePath = require.resolve("./messages");

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

function createApp(token: unknown = { scope: "identify lobbies.write" }) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "100000000000000004";
        req.user_bot = false;
        req.token = token as never;
        next();
    });
    app.use("/lobbies/:lobby_id/messages", lobbyMessagesRouter);
    app.use((error: { code?: number | string; httpStatus?: number; status?: number; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
        const httpStatus = error.httpStatus ?? error.status ?? (typeof error.code === "number" && error.code >= 100 && error.code <= 599 ? error.code : 500);
        res.status(httpStatus).json({
            code: error.code,
            message: error.message,
        });
    });

    return app;
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");

    try {
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`);
        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("GET /lobbies/:lobby_id/messages", () => {
    test("declares OAuth lobby message response metadata", (t) => {
        assert.deepEqual(setupRouteMetadataHarness(t), [
            {
                summary: "Get Lobby Messages",
                query: {
                    limit: {
                        type: "number",
                        description: "Max number of messages to return (1-200, default 50)",
                    },
                },
                responses: {
                    200: {
                        body: "LobbyMessagesResponse",
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
            },
        ]);
    });

    test("parses the required lobbies.write OAuth scope from supported token shapes", () => {
        assert.equal(hasLobbyWriteOAuthScope({ scope: "identify lobbies.write" }), true);
        assert.equal(hasLobbyWriteOAuthScope({ scopes: ["identify", "lobbies.write"] }), true);
        assert.equal(hasLobbyWriteOAuthScope({ scp: "identify,lobbies.write" }), true);
        assert.equal(hasLobbyWriteOAuthScope({ scope: "identify" }), false);
        assert.throws(() => assertLobbyWriteOAuthScope({ scope: "identify" }), {
            code: DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code,
        });
    });

    test("normalizes the documented message limit range", () => {
        assert.equal(parseLobbyMessagesLimit({}), 50);
        assert.equal(parseLobbyMessagesLimit({ limit: "1" }), 1);
        assert.equal(parseLobbyMessagesLimit({ limit: "200" }), 200);

        assert.throws(() => parseLobbyMessagesLimit({ limit: "0" }), /limit must be between 1 and 200/);
        assert.throws(() => parseLobbyMessagesLimit({ limit: "201" }), /limit must be between 1 and 200/);
        assert.throws(() => parseLobbyMessagesLimit({ limit: "abc" }), /limit must be between 1 and 200/);
    });

    test("fails closed when durable lobby message storage is absent", async () => {
        assert.equal(await getLobbyMessages("100000000000000001", "100000000000000004", 50), null);
        await assert.rejects(
            () => getLobbyMessages("not-a-lobby", "100000000000000004", 50),
            (error) => error === UNKNOWN_LOBBY,
        );
    });

    test("rejects missing lobby OAuth scope before lobby lookup", async () => {
        await assert.rejects(
            () => getLobbyMessagesForRequest("100000000000000001", "100000000000000004", { scope: "identify" }, {}),
            (error) => error === DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE,
        );
    });

    test("returns 404 unknown lobby for valid scoped requests without local lobby persistence", async () => {
        const response = await requestJson(createApp(), "/lobbies/100000000000000001/messages?limit=50");

        assert.deepEqual(response, {
            status: 404,
            body: {
                code: UNKNOWN_LOBBY.code,
                message: UNKNOWN_LOBBY.message,
            },
        });
    });

    test("invalid lobby IDs fail closed with the same unknown lobby error", async () => {
        const response = await requestJson(createApp(), "/lobbies/not-a-lobby/messages");

        assert.deepEqual(response, {
            status: 404,
            body: {
                code: UNKNOWN_LOBBY.code,
                message: UNKNOWN_LOBBY.message,
            },
        });
    });

    test("rejects tokens without the lobbies.write OAuth scope", async () => {
        const response = await requestJson(createApp({ scope: "identify" }), "/lobbies/100000000000000001/messages");

        assert.deepEqual(response, {
            status: 400,
            body: {
                code: DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.code,
                message: DiscordApiErrors.MISSING_REQUIRED_OAUTH2_SCOPE.message,
            },
        });
    });

    test("rejects out-of-range limits before returning the closed-storage lobby error", async () => {
        const response = await requestJson(createApp(), "/lobbies/100000000000000001/messages?limit=201");

        assert.deepEqual(response, {
            status: 400,
            body: {
                code: 400,
                message: "limit must be between 1 and 200",
            },
        });
    });
});
