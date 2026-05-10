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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import { buildApplicationActivityStatisticsResponse, createApplicationActivityStatisticsRouter } from "../../src/api/routes/activities/statistics/applications/#application_id";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/activities/statistics/applications/:application_id/"];
const routePath = "/activities/statistics/applications/{application_id}";
const sourceFile = "src/api/routes/activities/statistics/applications/#application_id.ts";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    type?: string;
};

describe("GET /activities/statistics/applications/:application_id", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/activities/statistics/applications/:application_id/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/activities/statistics/applications/100000000000000001"), false);

        const response = await requestJson(createAuthenticatedApp(), "/activities/statistics/applications/100000000000000001");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns a conservative empty statistics response", async () => {
        assert.deepEqual(
            buildApplicationActivityStatisticsResponse({
                applicationId: "100000000000000001",
                userId: "100000000000000002",
            }),
            [],
        );

        const response = await requestJson(createRouteApp(), "/activities/statistics/applications/100000000000000001");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("declares source-backed metadata and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "activities", "statistics", "applications", "#application_id.ts"), "utf8");
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
                path?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };

        assert.match(routeSource, /summary:\s*"Get Application Activity Statistics"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ApplicationActivityStatisticsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.ApplicationActivityStatisticsResponse.type, "array");
        assert.equal(schemas.ApplicationActivityStatisticsResponse.items?.$ref, "#/definitions/ApplicationActivityStatistics");
        assert.equal(schemas.ApplicationActivityStatistics.properties?.user_id?.type, "string");
        assert.equal(schemas.ApplicationActivityStatistics.properties?.last_played_at?.type, "string");
        assert.equal(schemas.ApplicationActivityStatistics.properties?.total_duration?.type, "integer");

        const route = openapi.paths?.["/activities/statistics/applications/{application_id}/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApplicationActivityStatisticsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, "/activities/statistics/applications/:application_id/");
        assert.equal(manifestEntry?.sourceFile, sourceFile);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ApplicationActivityStatisticsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === routePath);
        assert.equal(catalogEntry?.route_name, "GET_ACTIVITIES_STATISTICS_APPLICATIONS_APPLICATION_ID");
        assert.equal(catalogEntry?.source, sourceFile);
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApplicationActivityStatisticsResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "GET" &&
                    entry.route === "/activities/statistics/applications/{param}" &&
                    entry.route_name === "GET_ACTIVITIES_STATISTICS_APPLICATIONS_APPLICATION_ID",
            ),
            false,
        );
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000002";
        next();
    });
    app.use("/activities/statistics/applications/:application_id", createApplicationActivityStatisticsRouter());
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/activities/statistics/applications/:application_id", createApplicationActivityStatisticsRouter());
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
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
