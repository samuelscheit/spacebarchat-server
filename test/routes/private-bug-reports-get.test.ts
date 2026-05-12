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
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import privateBugReportsRouter, { listPrivateBugReports } from "../../src/api/routes/private/bug-reports";

const manifestId = "api:http:GET:/private/bug-reports/";

describe("GET /private/bug-reports", () => {
    test("returns an empty current-user bug report list without fabricating private state", async () => {
        assert.deepEqual(listPrivateBugReports("1044657759066525777"), []);

        const response = await requestRoute(createRouteApp(), "/private/bug-reports");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("stays behind bearer authentication and leaves bug-report submission unimplemented", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/private/bug-reports"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/private/bug-reports"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/private/bug-reports"), false);

        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "private", "bug-reports.ts"), "utf-8");
        assert.match(routeSource, /summary:\s*"Get Private Bug Reports"/);
        assert.match(routeSource, /body:\s*"PrivateBugReportsResponse"/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.post\(/);
        assert.doesNotMatch(routeSource, /router\.head\(/);
        assert.doesNotMatch(routeSource, /router\.options\(/);

        const response = await requestRoute(createRouteApp({ authentication: true }), "/private/bug-reports");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("is present in regenerated artifacts while adjacent private and reporting routes stay untouched", () => {
        const schemas = readJson<Record<string, JsonSchema>>(path.join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<TestingManifest>(path.join("assets", "testing-manifest.json"));
        const contracts = readJson<HttpContracts>(path.join("test", "generated", "http-contracts.json"));

        assert.equal(schemas.PrivateBugReportsResponse?.type, "array");
        assert.deepEqual(schemas.PrivateBugReportsResponse?.items, {});

        const openapiRoute = openapi.paths?.["/private/bug-reports/"];
        assert.equal(openapiRoute?.get?.summary, "Get Private Bug Reports");
        assert.deepEqual(openapiRoute?.get?.security, [{ bearer: [] }]);
        assert.equal(openapiRoute?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PrivateBugReportsResponse");
        assert.equal(openapiRoute?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.post, undefined);
        assert.equal(openapiRoute?.head, undefined);
        assert.equal(openapiRoute?.options, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/private/bug-reports"),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "PrivateBugReportsResponse"],
                route: "/private/bug-reports",
                route_name: "GET_PRIVATE_BUG_REPORTS",
                source: "src/api/routes/private/bug-reports.ts",
            },
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "POST" && entry.route === "/private/bug-reports"),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/private/bug-reports"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/private/bug-reports"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.route.startsWith("/reporting")),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/private/bug-reports.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "PrivateBugReportsResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/private/bug-reports/");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "PrivateBugReportsResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 401]);
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();

    if (options.authentication) {
        app.use(Authentication);
    } else {
        app.use((req, _res, next) => {
            req.user_id = "1044657759066525777";
            next();
        });
    }
    app.use("/private/bug-reports", privateBugReportsRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf-8")) as T;
}

async function requestRoute(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown; text: string }> {
    const { server, baseUrl } = await listen(app);
    try {
        const response = await fetch(`${baseUrl}${requestPath}`);
        const text = await response.text();

        return {
            status: response.status,
            body: text ? JSON.parse(text) : undefined,
            text,
        };
    } finally {
        await close(server);
    }
}

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

type JsonSchema = {
    type?: string;
    items?: JsonSchema;
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
                summary?: string;
            };
            post?: unknown;
            head?: unknown;
            options?: unknown;
        }
    >;
};

type SourceRouteCatalogEntry = {
    method?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};

type MissingRoutesReport = {
    missing_entries?: {
        method?: string;
        route: string;
    }[];
};

type TestingManifest = {
    entries?: {
        authMode?: string;
        id?: string;
        routeMetadata?: {
            responseBodies?: string[];
            responseStatuses?: number[];
        };
        sourceFile?: string;
    }[];
};

type HttpContracts = {
    contracts?: {
        authMode?: string;
        manifestId?: string;
        path?: string;
        routeMetadata?: {
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};
