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
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import apexExperimentsRouter from "../../src/api/routes/apex/experiments";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { Rights, SpacebarApiErrors } from "../../src/util";

const coveredManifestId = "api:http:GET:/apex/experiments/metadata";

describe("GET /apex/experiments/metadata", () => {
    test("stays behind bearer auth while adjacent Apex assignments remain public", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/apex/experiments?surface=2"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/apex/experiments/metadata?surface=2"), false);

        const response = await requestJson(createAuthenticatedApp(), "/apex/experiments/metadata?surface=2");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("requires operator rights for the employee-only metadata surface", async () => {
        const response = await requestJson(createRightsApp(new Rights(0)), "/apex/experiments/metadata?surface=2");

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: SpacebarApiErrors.MISSING_RIGHTS.code,
            message: SpacebarApiErrors.MISSING_RIGHTS.withParams("OPERATOR").message,
        });
    });

    test("returns a truthful empty metadata list for operators", async () => {
        const response = await requestJson(createRightsApp(new Rights("OPERATOR")), "/apex/experiments/metadata?surface=2");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            experiments: [],
        });
    });

    test("declares generated route, schema, query, and auth metadata", () => {
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as OpenApiDocument;
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as TestingManifest;
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as SourceRouteCatalogEntry[];

        const responseSchema = schemas.ApexExperimentsMetadataResponse;
        assert.equal(responseSchema.properties?.experiments?.type, "array");
        assert.equal(responseSchema.properties?.experiments?.items?.$ref, "#/definitions/ApexExperimentMetadata");
        assert.deepEqual(schemas.ApexExperimentMetadata.required, ["id", "name", "revision", "title", "unit_type", "variants"]);
        assert.deepEqual(schemas.ApexExperimentVariantMetadata.required, ["id", "label", "type"]);

        const route = openapi.paths["/apex/experiments/metadata"]?.get ?? openapi.paths["/apex/experiments/metadata/"]?.get;
        assert.equal(route?.summary, "Get Metadata for Apex Experiments");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ApexExperimentsMetadataResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const surfaceParameter = route?.parameters?.find((parameter) => parameter.name === "surface");
        assert.equal(surfaceParameter?.in, "query");
        assert.equal(surfaceParameter?.required, true);
        assert.equal(surfaceParameter?.schema?.type, "integer");

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.right, "OPERATOR");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ApexExperimentsMetadataResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(403), true);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/apex/experiments/metadata");
        assert.equal(catalogEntry?.source, "src/api/routes/apex/experiments.ts");
        assert.equal(catalogEntry?.route_name, "GET_APEX_EXPERIMENTS_METADATA");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ApexExperimentsMetadataResponse"]);
    });
});

function createAuthenticatedApp() {
    const app = express();
    app.use(Authentication);
    app.use("/apex/experiments", apexExperimentsRouter);
    app.use(ErrorHandler);
    return app;
}

function createRightsApp(rights: Rights) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "operator-user";
        req.rights = rights;
        next();
    });
    app.use("/apex/experiments", apexExperimentsRouter);
    app.use(ErrorHandler);
    return app;
}

type JsonSchema = {
    type?: string;
    $ref?: string;
    items?: { $ref?: string };
    required?: string[];
    properties?: Record<string, JsonSchema>;
};

type OpenApiDocument = {
    paths: Record<
        string,
        {
            get?: {
                summary?: string;
                parameters?: { name?: string; in?: string; required?: boolean; schema?: { type?: string } }[];
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
            };
        }
    >;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        routeMetadata?: {
            right?: string;
            hasQuery?: boolean;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SourceRouteCatalogEntry = {
    method?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};
