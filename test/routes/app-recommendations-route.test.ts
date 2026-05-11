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
import { ErrorHandler } from "@spacebar/api";
import express from "express";
import { Authentication, isNoAuthorizationRoute } from "../../src/api/middlewares";
import appRecommendationsRouter, { listAppRecommendations } from "../../src/api/routes/app-recommendations";

const coveredManifestIds = ["api:http:GET:/app-recommendations/"];

type JsonSchema = {
    $ref?: string;
    type?: string;
    items?: JsonSchema;
};

describe("GET /app-recommendations", () => {
    test("declares the app recommendations manifest route id covered by this suite", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/app-recommendations/"]);
    });

    test("lists no app recommendations until a durable recommendation source is available", () => {
        assert.deepEqual(listAppRecommendations("100000000000000001"), []);
        assert.notEqual(listAppRecommendations("100000000000000001"), listAppRecommendations("100000000000000001"));
    });

    test("returns an empty authenticated compatibility list without query-backed fabrication", async () => {
        const response = await requestJson(createRouteApp(), "/app-recommendations?locale=en-US&guild_id=100000000000000002");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("stays behind bearer auth and declares authenticated metadata", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/app-recommendations"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/app-recommendations/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/app-recommendations"), false);

        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "app-recommendations.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get App Recommendations"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"AppRecommendationsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        const response = await requestJson(createRouteApp({ authentication: true }), "/app-recommendations");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("generates response schema, route catalogs, and manifest metadata", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { in?: string }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            source?: string;
            response_schema_refs?: string[];
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string }[];
        };

        assert.equal(schemas.AppRecommendationsResponse.type, "array");
        assert.equal(schemas.AppRecommendationsResponse.items?.$ref, "#/definitions/ApplicationDirectoryApplication");

        const route = openapi.paths?.["/app-recommendations/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/AppRecommendationsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.parameters?.some((parameter) => parameter.in === "query") ?? false, false);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/app-recommendations/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/app-recommendations.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("AppRecommendationsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/app-recommendations");
        assert.equal(catalogEntry?.source, "src/api/routes/app-recommendations.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["APIErrorResponse", "AppRecommendationsResponse"]);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/app-recommendations"),
            false,
        );
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();

    if (options.authentication) {
        app.use(Authentication);
    } else {
        app.use((req, _res, next) => {
            req.user_id = "100000000000000001";
            next();
        });
    }
    app.use("/app-recommendations", appRecommendationsRouter);
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
