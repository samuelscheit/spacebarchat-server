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
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express from "express";
import { ErrorHandler } from "../../src/api/middlewares";
import gamesRouter, { parseGameIdsQuery } from "../../src/api/routes/games";
import type { GameApplication } from "../../src/api/routes/games/#game_id";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const util = require("@spacebar/util") as typeof import("../../src/util");

type MutableUtil = typeof util & {
    Application: typeof import("../../src/util").Application;
};

type JsonResponse = {
    status: number;
    body: unknown;
};

const mutableUtil = util as MutableUtil;

afterEach(() => {
    assert.equal(typeof mutableUtil.Application.find, "function");
});

describe("GET /games helpers", () => {
    test("parses repeated, bracketed, and comma-separated game IDs", () => {
        assert.deepEqual(
            parseGameIdsQuery({
                game_ids: ["100000000000000001,100000000000000002", "100000000000000001"],
                "game_ids[]": "100000000000000003",
            }),
            ["100000000000000001", "100000000000000002", "100000000000000003"],
        );
    });

    test("validates the documented 1-25 snowflake query contract", () => {
        assert.throws(() => parseGameIdsQuery({}), {
            message: "Invalid Form Body",
        });
        assert.throws(() => parseGameIdsQuery({ game_ids: "not-a-snowflake" }), {
            message: "Invalid Form Body",
        });
        assert.throws(() => parseGameIdsQuery({ game_ids: Array.from({ length: 26 }, (_, index) => `1000000000000000${String(index).padStart(2, "0")}`) }), {
            message: "Invalid Form Body",
        });
    });
});

describe("GET /games route", () => {
    test("returns requested local games in request order", async (t) => {
        const harness = setupRoute(t);
        const response = await requestJson(harness.app, "/games?game_ids=100000000000000002&game_ids=100000000000000001&game_ids=100000000000000099&with_supplemental_data=false");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                id: "100000000000000002",
                name: "Second Game",
                icon_hash: null,
                cover_image_hash: "cover-two",
                aliases: [],
                executables: [],
                themes: [],
                hook: false,
                overlay: false,
                overlay_methods: null,
                overlay_warn: false,
                overlay_compatibility_hook: false,
                companies: [],
            },
            {
                id: "100000000000000001",
                name: "First Game",
                icon_hash: "icon-one",
                cover_image_hash: null,
                aliases: [],
                executables: [],
                themes: [],
                hook: true,
                overlay: false,
                overlay_methods: null,
                overlay_warn: false,
                overlay_compatibility_hook: false,
                companies: [],
            },
        ]);
        assert.equal(harness.findOptions.length, 1);
        assert.deepEqual(Object.keys(harness.findOptions[0]?.select ?? {}).sort(), ["announcements_channel_id", "cover_image", "hook", "icon", "id", "name", "summary"]);
    });

    test("returns supplemental game data by default", async (t) => {
        const harness = setupRoute(t);
        const response = await requestJson(harness.app, "/games?game_ids=100000000000000001");

        assert.equal(response.status, 200);
        assert.deepEqual((response.body as { supplemental_game_data?: unknown }[])[0]?.supplemental_game_data, {
            application_id: "100000000000000001",
            name: "First Game",
            summary: "The first game.",
            icon_hash: "icon-one",
            announcements_channel_id: "100000000000000011",
        });
    });

    test("rejects invalid game ID queries with field errors", async (t) => {
        const harness = setupRoute(t);
        const response = await requestJson(harness.app, "/games?game_ids=not-a-snowflake");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 50035,
            message: "Invalid Form Body",
            errors: {
                game_ids: {
                    _errors: [
                        {
                            code: "BASE_TYPE_INVALID",
                            message: "game_ids must contain valid snowflakes",
                        },
                    ],
                },
            },
        });
    });

    test("declares the generated response schema shape", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, { type?: string; items?: { $ref?: string } }>;
        const response = schemas.GamesResponse;

        assert.ok(response);
        assert.equal(response.type, "array");
        assert.equal(response.items?.$ref, "#/definitions/GameResponse");
    });

    test("declares 200, 400, and 401 response metadata and remains bearer-authenticated", () => {
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        const route = openapi.paths?.["/games/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GamesResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/games/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GamesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(400), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
    });
});

function setupRoute(t: TestContext) {
    const app = express();
    const findOptions: { where?: { id?: unknown }; select?: Record<string, boolean> }[] = [];
    const applications = [
        createApplication("100000000000000001", "First Game", "icon-one", undefined, "The first game.", true),
        createApplication("100000000000000002", "Second Game", undefined, "cover-two", "", false),
    ];

    t.mock.method(mutableUtil.Application, "find", async (findOptionsInput: { where?: { id?: unknown }; select?: Record<string, boolean> }) => {
        findOptions.push(findOptionsInput);
        return applications;
    });

    app.use((req, _res, next) => {
        (req as express.Request & { user_id: string }).user_id = "user";
        next();
    });
    app.use("/games", gamesRouter);
    app.use(ErrorHandler);

    return { app, findOptions };
}

function createApplication(id: string, name: string, icon: string | undefined, coverImage: string | undefined, summary: string, hook: boolean): GameApplication {
    return {
        id,
        name,
        icon,
        cover_image: coverImage,
        summary,
        hook,
        announcements_channel_id: "100000000000000011",
    };
}

async function requestJson(app: express.Express, path: string): Promise<JsonResponse> {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await close(server);
    }
}

function close(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
