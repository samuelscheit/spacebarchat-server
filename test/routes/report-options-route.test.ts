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
import reportOptionsRouter, { listReportOptions } from "../../src/api/routes/report/options";

type JsonSchema = {
    $ref?: string;
    type?: string;
    required?: string[];
    additionalProperties?: boolean;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
};

describe("GET /report/options", () => {
    test("lists no staged report options until a source-backed provider is configured", () => {
        assert.deepEqual(listReportOptions(), []);
        assert.notEqual(listReportOptions(), listReportOptions(), "callers should receive a fresh list");
    });

    test("returns the conservative report options response shape for authenticated callers", async () => {
        const response = await requestJson(createRouteApp({ authenticated: true }), "/report/options");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("is bearer-authenticated through the authentication middleware", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/report/options"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/report/options/"), false);

        const response = await requestJson(createRouteApp({ authenticationMiddleware: true }), "/report/options");

        assert.equal(response.status, 401);
        assert.deepEqual(response.body, {
            code: 401,
            message: "Error: Missing Authorization Header",
        });
    });

    test("declares source-backed route metadata", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "report", "options.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Report Options"/);
        assert.match(routeSource, /description:\s*"Returns report option objects that can be used when creating a staged message report\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ReportOptionsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });

    test("generates response schema and route artifact metadata", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
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
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            response_schema_refs?: string[];
        }[];

        assert.equal(schemas.ReportOptionsResponse.type, "array");
        assert.equal(schemas.ReportOptionsResponse.items?.$ref, "#/definitions/ReportOptionResponse");
        assert.deepEqual(schemas.ReportOptionResponse.required, ["description", "label", "value"]);
        assert.equal(schemas.ReportOptionResponse.properties?.sub_types?.type, "array");
        assert.equal(schemas.ReportOptionResponse.properties?.sub_types?.items?.$ref, "#/definitions/ReportOptionSubTypeResponse");
        assert.deepEqual(schemas.ReportOptionSubTypeResponse.required, ["label", "value"]);

        const route = openapi.paths?.["/report/options/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ReportOptionsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/report/options/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ReportOptionsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);

        const sourceCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/report/options");
        assert.equal(sourceCatalogEntry?.route_name, "GET_REPORT_OPTIONS");
        assert.deepEqual(sourceCatalogEntry?.response_schema_refs, ["APIErrorResponse", "ReportOptionsResponse"]);
    });
});

function createRouteApp(options: { authenticated?: boolean; authenticationMiddleware?: boolean }) {
    const app = express();

    if (options.authenticationMiddleware) app.use(Authentication);
    if (options.authenticated) {
        app.use((req, _res, next) => {
            req.user_id = "viewer";
            next();
        });
    }
    app.use("/report/options", reportOptionsRouter);
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
