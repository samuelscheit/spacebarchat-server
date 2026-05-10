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
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createDetectableNonGameApplicationsRouter,
    DISCORD_DETECTABLE_NON_GAME_APPLICATIONS_URL,
    normalizeDetectableNonGameApplicationsPayload,
} from "../../src/api/routes/applications/non-games/detectable";

describe("GET /applications/non-games/detectable", () => {
    test("normalizes the documented provider response shape", () => {
        const applications = [
            {
                id: "100000000000000001",
                name: "Visual Studio Code",
                aliases: ["Code"],
                executables: [{ os: "win32", name: "Code.exe", is_launcher: false }],
                themes: ["Development"],
                hook: false,
                overlay: false,
                overlay_methods: null,
                overlay_warn: false,
                overlay_compatibility_hook: false,
            },
        ];

        assert.equal(normalizeDetectableNonGameApplicationsPayload(applications), applications);
        assert.throws(() => normalizeDetectableNonGameApplicationsPayload({ applications }), /Failed to fetch detectable non-game applications/);
    });

    test("returns upstream non-game detectable applications and caches the payload", async () => {
        let fetchCount = 0;
        let currentTime = 10_000;
        const app = createRouteApp({
            now: () => currentTime,
            fetcher: async (input, init) => {
                fetchCount += 1;
                assert.equal(String(input), DISCORD_DETECTABLE_NON_GAME_APPLICATIONS_URL);
                assert.equal(new Headers(init?.headers).get("Accept"), "application/json");

                return Response.json([{ id: "100000000000000001", name: "Code", executables: [] }]);
            },
        });

        const response = await requestJson(app, "/applications/non-games/detectable");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [{ id: "100000000000000001", name: "Code", executables: [] }]);
        assert.match(response.headers.get("cache-control") ?? "", /public, max-age=21600, s-maxage=21600, immutable/);

        currentTime += 1_000;
        const cachedResponse = await requestJson(app, "/applications/non-games/detectable");

        assert.equal(cachedResponse.status, 200);
        assert.deepEqual(cachedResponse.body, [{ id: "100000000000000001", name: "Code", executables: [] }]);
        assert.match(cachedResponse.headers.get("cache-control") ?? "", /public, max-age=21599, s-maxage=21599, immutable/);
        assert.equal(fetchCount, 1);
    });

    test("serves the stale cache if the upstream refresh fails", async () => {
        let fetchCount = 0;
        let currentTime = 10_000;
        const app = createRouteApp({
            cacheTtlMs: 1_000,
            now: () => currentTime,
            fetcher: async () => {
                fetchCount += 1;
                if (fetchCount === 1) return Response.json([{ id: "100000000000000001", name: "Code" }]);
                return new Response("unavailable", { status: 503 });
            },
        });

        const response = await requestJson(app, "/applications/non-games/detectable");
        assert.equal(response.status, 200);

        currentTime += 2_000;
        const staleResponse = await requestJson(app, "/applications/non-games/detectable");

        assert.equal(staleResponse.status, 200);
        assert.deepEqual(staleResponse.body, [{ id: "100000000000000001", name: "Code" }]);
        assert.match(staleResponse.headers.get("cache-control") ?? "", /public, max-age=0, s-maxage=0, immutable/);
        assert.equal(fetchCount, 2);
    });

    test("returns a 502 API error when the upstream source is unavailable before cache warmup", async () => {
        const response = await requestJson(
            createRouteApp({
                fetcher: async () => new Response("unavailable", { status: 503 }),
            }),
            "/applications/non-games/detectable",
        );

        assert.equal(response.status, 502);
        assert.deepEqual(response.body, {
            code: 502,
            message: "Error: Failed to fetch detectable non-game applications",
        });
    });

    test("is a public API route through the authentication middleware", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/applications/non-games/detectable"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/applications/non-games/detectable/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/applications/non-games/detectable"), false);

        const response = await requestJson(
            createRouteApp({
                authentication: true,
                fetcher: async () => Response.json([{ id: "100000000000000001", name: "Code" }]),
            }),
            "/applications/non-games/detectable",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [{ id: "100000000000000001", name: "Code" }]);
    });

    test("declares public response metadata in generated route artifacts", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, { type?: string }>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<string, { get?: { summary?: string; responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const catalog = JSON.parse(readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8")) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];

        assert.equal(schemas.ApplicationDetectableResponse.type, "array");

        const route = openapi.paths?.["/applications/non-games/detectable/"]?.get;
        assert.equal(route?.summary, "Get Detectable Non Game Applications");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationDetectableResponse");
        assert.equal(route?.responses?.["502"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.security, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/applications/non-games/detectable/");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/applications/non-games/detectable.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ApplicationDetectableResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(502), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), false);

        const catalogEntry = catalog.find((entry) => entry.method === "GET" && entry.route === "/applications/non-games/detectable");
        assert.equal(catalogEntry?.route_name, "GET_APPLICATIONS_NON_GAMES_DETECTABLE");
        assert.equal(catalogEntry?.source, "src/api/routes/applications/non-games/detectable.ts");
        assert.equal(catalogEntry?.response_schema_refs?.includes("ApplicationDetectableResponse"), true);
        assert.equal(catalogEntry?.response_schema_refs?.includes("APIErrorResponse"), true);
    });
});

function createRouteApp(options: { authentication?: boolean; cacheTtlMs?: number; fetcher?: typeof fetch; now?: () => number }) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    app.use("/applications/non-games/detectable", createDetectableNonGameApplicationsRouter({ cacheTtlMs: options.cacheTtlMs, fetcher: options.fetcher, now: options.now }));
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
