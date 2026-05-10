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
import { createDetectableGameExclusionsRouter, normalizeDetectableGameExclusionsPayload } from "../../src/api/routes/games/detectable/exclusions";

describe("GET /games/detectable/exclusions", () => {
    test("normalizes the documented provider response shape", () => {
        assert.deepEqual(
            normalizeDetectableGameExclusionsPayload({
                executables: ["launcher.exe", 7, "install.exe"],
                patterns: ["vcredist.*\\.exe$", null],
                ignored: true,
            }),
            {
                executables: ["launcher.exe", "install.exe"],
                patterns: ["vcredist.*\\.exe$"],
            },
        );

        assert.deepEqual(normalizeDetectableGameExclusionsPayload(null), {
            executables: [],
            patterns: [],
        });
    });

    test("returns normalized exclusions and caches the upstream payload", async () => {
        let fetchCount = 0;
        let currentTime = 10_000;
        const app = createRouteApp({
            now: () => currentTime,
            fetcher: async () => {
                fetchCount += 1;
                return Response.json({
                    executables: ["launcher.exe", 123],
                    patterns: ["vcredist.*\\.exe$", false],
                });
            },
        });

        const response = await requestJson(app, "/games/detectable/exclusions");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            executables: ["launcher.exe"],
            patterns: ["vcredist.*\\.exe$"],
        });
        assert.match(response.headers.get("cache-control") ?? "", /public, max-age=3600, s-maxage=3600, immutable/);

        currentTime += 1_000;
        const cachedResponse = await requestJson(app, "/games/detectable/exclusions");

        assert.equal(cachedResponse.status, 200);
        assert.deepEqual(cachedResponse.body, {
            executables: ["launcher.exe"],
            patterns: ["vcredist.*\\.exe$"],
        });
        assert.match(cachedResponse.headers.get("cache-control") ?? "", /public, max-age=3599, s-maxage=3599, immutable/);
        assert.equal(fetchCount, 1);
    });

    test("returns a 502 API error when the upstream source is unavailable before cache warmup", async () => {
        const response = await requestJson(
            createRouteApp({
                fetcher: async () => new Response("unavailable", { status: 503 }),
            }),
            "/games/detectable/exclusions",
        );

        assert.equal(response.status, 502);
        assert.deepEqual(response.body, {
            code: 502,
            message: "Error: Failed to fetch detectable game exclusions",
        });
    });

    test("is a public API route through the authentication middleware", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/games/detectable/exclusions"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/games/detectable/exclusions"), false);

        const response = await requestJson(
            createRouteApp({
                authentication: true,
                fetcher: async () =>
                    Response.json({
                        executables: ["launcher.exe"],
                        patterns: [],
                    }),
            }),
            "/games/detectable/exclusions",
        );

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            executables: ["launcher.exe"],
            patterns: [],
        });
    });

    test("declares public response metadata in generated route artifacts", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<
            string,
            { properties?: Record<string, unknown>; required?: string[] }
        >;
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

        assert.deepEqual(schemas.DetectableGameExclusionsResponse.required, ["executables", "patterns"]);
        assert.deepEqual(schemas.DetectableGameExclusionsResponse.properties?.executables, {
            type: "array",
            items: { type: "string" },
        });
        assert.deepEqual(schemas.DetectableGameExclusionsResponse.properties?.patterns, {
            type: "array",
            items: { type: "string" },
        });

        const route = openapi.paths?.["/games/detectable/exclusions/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/DetectableGameExclusionsResponse");
        assert.equal(route?.responses?.["502"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.security, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/games/detectable/exclusions/");
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("DetectableGameExclusionsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(502), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), false);
    });
});

function createRouteApp(options: { authentication?: boolean; fetcher?: typeof fetch; now?: () => number }) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    app.use("/games/detectable/exclusions", createDetectableGameExclusionsRouter({ fetcher: options.fetcher, now: options.now }));
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
