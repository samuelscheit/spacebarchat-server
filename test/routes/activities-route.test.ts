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
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import activitiesRouter, { createActivitiesRouter, getGlobalActivityStatisticsResponse, updateActivitySession } from "../../src/api/routes/activities";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/activities/", "api:http:POST:/activities/"];

describe("GET and POST /activities", () => {
    test("declares the assigned manifest route ids", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/activities/", "api:http:POST:/activities/"]);
    });

    test("builds conservative global statistics and activity session token responses", () => {
        assert.deepEqual(
            getGlobalActivityStatisticsResponse({
                userId: "viewer",
                withUsers: true,
                withApplications: true,
            }),
            [],
        );

        assert.deepEqual(
            updateActivitySession({ application_id: "100000000000000001", token: "existing-token" }, () => "generated-token"),
            {
                token: "existing-token",
            },
        );
        assert.deepEqual(
            updateActivitySession({ application_id: "100000000000000001" }, () => "generated-token"),
            { token: "generated-token" },
        );
    });

    test("returns an empty global activity statistics list for authenticated requests", async () => {
        const response = await requestJson(createAuthenticatedApp(), "/activities?with_users=true&with_applications=true");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("validates and accepts activity session updates without fabricating statistics", async () => {
        const response = await requestJson(createAuthenticatedApp(createActivitiesRouter({ activitySessionTokenFactory: () => "generated-token" })), "/activities", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                token: "existing-token",
                application_id: "100000000000000001",
                duration: 30,
                share_activity: true,
                distributor: "discord",
                exe_path: "/Applications/Game.app",
                session_id: "session-id",
                media_session_id: "media-session-id",
                closed: false,
            }),
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { token: "existing-token" });
    });

    test("rejects invalid activity session update bodies", async () => {
        const response = await requestJson(createAuthenticatedApp(), "/activities", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ duration: "30" }),
        });

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, 50035);
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/activities", activitiesRouter);
        app.use(ErrorHandler);

        const getResponse = await requestJson(app, "/activities");
        const postResponse = await requestJson(app, "/activities", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ application_id: "100000000000000001" }),
        });

        assert.equal(getResponse.status, 401);
        assert.equal((getResponse.body as { code?: unknown }).code, 401);
        assert.equal(postResponse.status, 401);
        assert.equal((postResponse.body as { code?: unknown }).code, 401);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/activities"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/activities"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/activities"), false);
    });

    test("declares schemas and generated route artifacts", () => {
        const schemas = readJson<Record<string, JsonSchema>>("assets", "schemas.json");
        const openapi = readJson<OpenApiDocument>("assets", "openapi.json");
        const manifest = readJson<TestingManifest>("assets", "testing-manifest.json");
        const sourceCatalog = readJson<SourceCatalogEntry[]>("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json");

        const globalStatistics = schemas.GlobalActivityStatistics;
        assert.deepEqual(globalStatistics.required?.sort(), ["application_id", "duration", "updated_at", "user_id"]);
        assert.equal(globalStatistics.properties?.user?.$ref, "#/definitions/PartialUser");
        assert.equal(globalStatistics.properties?.application?.$ref, "#/definitions/GlobalActivityStatisticsApplication");
        assert.equal(schemas.GlobalActivityStatisticsResponse.items?.$ref, "#/definitions/GlobalActivityStatistics");

        assert.deepEqual(schemas.ActivitySessionUpdateSchema.required, ["application_id"]);
        assert.equal(schemas.ActivitySessionUpdateSchema.properties?.duration?.maximum, 1800);
        assert.equal(schemas.ActivitySessionUpdateSchema.properties?.exe_path?.maxLength, 128);
        assert.deepEqual(schemas.ActivitySessionUpdateResponse.required, ["token"]);

        const getRoute = openapi.paths?.["/activities/"]?.get;
        assert.deepEqual(
            getRoute?.parameters?.map((parameter) => parameter.name),
            ["with_users", "with_applications"],
        );
        assert.deepEqual(
            getRoute?.parameters?.map((parameter) => parameter.schema?.type),
            ["boolean", "boolean"],
        );
        assert.equal(getRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GlobalActivityStatisticsResponse");
        assert.equal(getRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(getRoute?.security, [{ bearer: [] }]);

        const postRoute = openapi.paths?.["/activities/"]?.post;
        assert.equal(postRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ActivitySessionUpdateSchema");
        assert.equal(postRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ActivitySessionUpdateResponse");
        assert.equal(postRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(postRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(postRoute?.security, [{ bearer: [] }]);

        const getManifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(getManifestEntry?.authMode, "bearer");
        assert.equal(getManifestEntry?.routeMetadata?.hasQuery, true);
        assert.deepEqual(getManifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "GlobalActivityStatisticsResponse"]);
        assert.deepEqual(
            getManifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const postManifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[1]);
        assert.equal(postManifestEntry?.authMode, "bearer");
        assert.equal(postManifestEntry?.routeMetadata?.requestBody, "ActivitySessionUpdateSchema");
        assert.deepEqual(postManifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "ActivitySessionUpdateResponse"]);
        assert.deepEqual(
            postManifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 400, 401],
        );

        const getCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/activities");
        assert.equal(getCatalogEntry?.route_name, "GET_ACTIVITIES");
        assert.equal(getCatalogEntry?.source, "src/api/routes/activities.ts");
        assert.deepEqual(getCatalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GlobalActivityStatisticsResponse"]);

        const postCatalogEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/activities");
        assert.equal(postCatalogEntry?.route_name, "POST_ACTIVITIES");
        assert.equal(postCatalogEntry?.source, "src/api/routes/activities.ts");
        assert.equal(postCatalogEntry?.request_schema_ref, "ActivitySessionUpdateSchema");
        assert.deepEqual(postCatalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ActivitySessionUpdateResponse"]);
    });
});

function createAuthenticatedApp(router = activitiesRouter) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/activities", router);
    app.use(ErrorHandler);
    return app;
}

function readJson<T>(...segments: string[]): T {
    return JSON.parse(readFileSync(join(process.cwd(), ...segments), "utf8")) as T;
}

async function requestJson(app: express.Express, requestPath: string, init?: RequestInit) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init);
        const text = await response.text();

        return {
            status: response.status,
            body: text ? (JSON.parse(text) as unknown) : undefined,
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    maxLength?: number;
    maximum?: number;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

type OpenApiDocument = {
    paths?: Record<
        string,
        Record<
            string,
            {
                parameters?: { name?: string; schema?: { type?: string } }[];
                requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
            }
        >
    >;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        routeMetadata?: {
            hasQuery?: boolean;
            requestBody?: string;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SourceCatalogEntry = {
    method?: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};
