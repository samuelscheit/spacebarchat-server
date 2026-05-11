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
import lobbyRouter, { getLobby, getLobbyForRequest, isLobbyId, UNKNOWN_LOBBY } from ".";

const requireModule = require;
const routeModulePath = require.resolve(".");

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

function createApp(userIsBot = true) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "100000000000000004";
        req.user_bot = userIsBot;
        next();
    });
    app.use("/lobbies/:lobby_id", lobbyRouter);
    app.use((error: { code?: number | string; httpStatus?: number; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
        res.status(error.httpStatus ?? 500).json({
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

describe("GET /lobbies/:lobby_id", () => {
    test("declares authenticated lobby response metadata", (t) => {
        assert.deepEqual(setupRouteMetadataHarness(t), [
            {
                summary: "Get Lobby",
                responses: {
                    200: {
                        body: "LobbyResponse",
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

    test("validates lobby IDs as Discord snowflakes", () => {
        assert.equal(isLobbyId("100000000000000001"), true);
        assert.equal(isLobbyId("99999999999999999999"), true);
        assert.equal(isLobbyId(""), false);
        assert.equal(isLobbyId("123"), false);
        assert.equal(isLobbyId("0100000000000000001"), false);
        assert.equal(isLobbyId("not-a-lobby"), false);
        assert.equal(isLobbyId("100000000000000001000"), false);
    });

    test("fails closed when durable lobby storage is absent", async () => {
        assert.equal(await getLobby("100000000000000001", "100000000000000004"), null);
        await assert.rejects(
            () => getLobby("not-a-lobby", "100000000000000004"),
            (error) => error === UNKNOWN_LOBBY,
        );
    });

    test("rejects user accounts before lobby lookup", async () => {
        await assert.rejects(
            () => getLobbyForRequest("100000000000000001", "100000000000000004", false),
            (error) => error === DiscordApiErrors.BOT_ONLY_ENDPOINT,
        );
    });

    test("returns 404 unknown lobby for valid bot requests without local lobby persistence", async () => {
        const response = await requestJson(createApp(), "/lobbies/100000000000000001");

        assert.deepEqual(response, {
            status: 404,
            body: {
                code: UNKNOWN_LOBBY.code,
                message: UNKNOWN_LOBBY.message,
            },
        });
    });

    test("invalid lobby IDs fail closed with the same unknown lobby error", async () => {
        const response = await requestJson(createApp(), "/lobbies/not-a-lobby");

        assert.deepEqual(response, {
            status: 404,
            body: {
                code: UNKNOWN_LOBBY.code,
                message: UNKNOWN_LOBBY.message,
            },
        });
    });

    test("rejects user accounts with the bot-only endpoint error", async () => {
        const response = await requestJson(createApp(false), "/lobbies/100000000000000001");

        assert.deepEqual(response, {
            status: 400,
            body: {
                code: DiscordApiErrors.BOT_ONLY_ENDPOINT.code,
                message: DiscordApiErrors.BOT_ONLY_ENDPOINT.message,
            },
        });
    });
});
