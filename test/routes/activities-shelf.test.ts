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
import activityShelfRouter, { getActivityShelfResponse } from "../../src/api/routes/activities/shelf";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestId = "api:http:GET:/activities/shelf/";

describe("GET /activities/shelf", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/activities/shelf/");
    });

    test("returns the conservative empty embedded activity shelf response", () => {
        assert.deepEqual(getActivityShelfResponse(), {
            activities: [],
            applications: [],
            assets: {},
        });
    });

    test("returns a documented empty shelf for authenticated requests with guild_id", async () => {
        const app = express();
        app.use((req, _res, next) => {
            req.user_id = "viewer";
            next();
        });
        app.use("/activities/shelf", activityShelfRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/activities/shelf?guild_id=100000000000000001");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            activities: [],
            applications: [],
            assets: {},
        });
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/activities/shelf", activityShelfRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/activities/shelf");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/activities/shelf"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/activities/shelf"), false);
    });

    test("declares response schemas and generated route artifacts", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; schema?: { type?: string } }[];
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
            source?: string;
            response_schema_refs?: string[];
        }[];

        const responseSchema = schemas.ActivityShelfResponse;
        assert.deepEqual(responseSchema.required?.sort(), ["activities", "applications", "assets"]);
        assert.equal(responseSchema.properties?.activities?.items?.$ref, "#/definitions/EmbeddedActivityConfig");
        assert.equal(responseSchema.properties?.applications?.items?.$ref, "#/definitions/ActivityShelfApplication");
        assert.equal(responseSchema.properties?.assets?.$ref, "#/definitions/ActivityShelfAssets");

        const route = openapi.paths?.["/activities/shelf/"]?.get;
        assert.deepEqual(
            route?.parameters?.map((parameter) => parameter.name),
            ["guild_id"],
        );
        assert.equal(route?.parameters?.[0]?.schema?.type, "string");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ActivityShelfResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ActivityShelfResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/activities/shelf");
        assert.equal(catalogEntry?.route_name, "GET_ACTIVITIES_SHELF");
        assert.equal(catalogEntry?.source, "src/api/routes/activities/shelf.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ActivityShelfResponse"]);
    });
});

async function requestJson(app: express.Express, requestPath: string) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
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
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    $ref?: string;
};
