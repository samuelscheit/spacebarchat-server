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
import gameRouter, { serializeApplicationGame, shouldIncludeGameSupplementalData, type GameApplication } from "../../src/api/routes/games/#game_id";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const util = require("@spacebar/util") as typeof import("../../src/util");

type MutableUtil = typeof util & {
    Application: typeof import("../../src/util").Application;
};

type JsonResponse = {
    status: number;
    body: Record<string, unknown>;
};

const mutableUtil = util as MutableUtil;

afterEach(() => {
    assert.equal(typeof mutableUtil.Application.findOne, "function");
});

describe("GET /games/:game_id helpers", () => {
    test("parses supplemental data query values with the documented default", () => {
        assert.equal(shouldIncludeGameSupplementalData(undefined), true);
        assert.equal(shouldIncludeGameSupplementalData(""), true);
        assert.equal(shouldIncludeGameSupplementalData("true"), true);
        assert.equal(shouldIncludeGameSupplementalData("false"), false);
        assert.equal(shouldIncludeGameSupplementalData("FALSE"), false);
        assert.equal(shouldIncludeGameSupplementalData(["false", "true"]), false);
    });

    test("serializes local applications as game responses", () => {
        const response = serializeApplicationGame(createApplication());

        assert.equal(response.id, "game");
        assert.equal(response.name, "Space Adventure");
        assert.equal(response.icon_hash, "icon-hash");
        assert.equal(response.cover_image_hash, "cover-hash");
        assert.deepEqual(response.aliases, []);
        assert.deepEqual(response.executables, []);
        assert.deepEqual(response.themes, []);
        assert.equal(response.hook, true);
        assert.equal(response.overlay, false);
        assert.equal(response.overlay_methods, null);
        assert.equal(response.overlay_warn, false);
        assert.equal(response.overlay_compatibility_hook, false);
        assert.deepEqual(response.companies, []);
        assert.deepEqual(response.supplemental_game_data, {
            application_id: "game",
            name: "Space Adventure",
            summary: "Explore the station.",
            icon_hash: "icon-hash",
            announcements_channel_id: "news",
        });
    });

    test("omits supplemental data when requested", () => {
        const response = serializeApplicationGame(createApplication(), false);

        assert.equal(response.supplemental_game_data, undefined);
    });
});

describe("GET /games/:game_id route", () => {
    test("returns a game response for the requested application", async (t) => {
        const harness = setupRoute(t);
        const response = await requestJson(harness.app, "/games/game?with_supplemental_data=false");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: "game",
            name: "Space Adventure",
            icon_hash: "icon-hash",
            cover_image_hash: "cover-hash",
            aliases: [],
            executables: [],
            themes: [],
            hook: true,
            overlay: false,
            overlay_methods: null,
            overlay_warn: false,
            overlay_compatibility_hook: false,
            companies: [],
        });
        assert.equal(harness.findOptions[0]?.where?.id, "game");
        assert.deepEqual(Object.keys(harness.findOptions[0]?.select ?? {}).sort(), ["announcements_channel_id", "cover_image", "hook", "icon", "id", "name", "summary"]);
    });

    test("returns unknown application for missing games", async (t) => {
        const harness = setupRoute(t, { application: null });
        const response = await requestJson(harness.app, "/games/missing");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: util.DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: util.DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("declares the generated response schema shape", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, { properties?: Record<string, unknown> }>;
        const response = schemas.GameResponse;

        assert.ok(response);
        assert.equal(response.properties?.id && (response.properties.id as { type?: string }).type, "string");
        assert.equal(response.properties?.name && (response.properties.name as { type?: string }).type, "string");
        assert.deepEqual(response.properties?.aliases, {
            type: "array",
            items: { type: "string" },
        });
        assert.equal(response.properties?.supplemental_game_data && (response.properties.supplemental_game_data as { $ref?: string }).$ref, "#/definitions/GameSupplementalData");
    });

    test("declares 200 and 401 response metadata and remains bearer-authenticated", () => {
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

        const route = openapi.paths?.["/games/{game_id}/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GameResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/games/:game_id/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GameResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
    });
});

function setupRoute(t: TestContext, setupOptions: { application?: GameApplication | null } = {}) {
    const app = express();
    const findOptions: { where?: { id?: string }; select?: Record<string, boolean> }[] = [];

    t.mock.method(mutableUtil.Application, "findOne", async (findOptionsInput: { where?: { id?: string }; select?: Record<string, boolean> }) => {
        findOptions.push(findOptionsInput);
        return "application" in setupOptions ? setupOptions.application : createApplication();
    });

    app.use((req, _res, next) => {
        (req as express.Request & { user_id: string }).user_id = "user";
        next();
    });
    app.use("/games/:game_id", gameRouter);
    app.use((error: Error & { httpStatus?: number; status?: number; code?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.httpStatus ?? error.status ?? 500).json({
            code: error.code,
            message: error.message,
        });
    });

    return { app, findOptions };
}

function createApplication(): GameApplication {
    return {
        id: "game",
        name: "Space Adventure",
        icon: "icon-hash",
        cover_image: "cover-hash",
        summary: "Explore the station.",
        hook: true,
        announcements_channel_id: "news",
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
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await close(server);
    }
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
