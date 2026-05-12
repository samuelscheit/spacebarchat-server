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
import relationshipsRouter, { USER_BULK_RELATIONSHIPS_PUT_UNSUPPORTED_MESSAGE, createUserBulkRelationshipsPutUnsupportedError } from "../../src/api/routes/users/@me/relationships";

const coveredManifestIds = ["api:http:PUT:/users/@me/relationships/bulk"];

interface RouteCatalogEntry {
    method?: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
    route?: string;
    source?: string;
}

interface MissingRouteEntry {
    method?: string;
    route?: string;
}

interface OpenApiOperation {
    requestBody?: unknown;
    responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
    security?: { bearer?: unknown[] }[];
}

interface ManifestEntry {
    authMode?: string;
    id?: string;
    routeMetadata?: {
        requestBody?: string;
        responseBodies?: string[];
        responseStatuses?: number[];
    };
    sourceFile?: string;
}

interface ContractEntry {
    manifestId?: string;
    routeMetadata?: {
        requestBody?: string;
        responses?: string[];
        responseStatuses?: number[];
    };
}

type JsonObject = Record<string, unknown>;

describe("PUT /users/@me/relationships/bulk", () => {
    test("declares the assigned manifest id and stays behind bearer authentication", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:PUT:/users/@me/relationships/bulk"]);
        assert.equal(isNoAuthorizationRoute("PUT", "/api/v10/users/@me/relationships/bulk"), false);

        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/users/@me/relationships", relationshipsRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/users/@me/relationships/bulk", {
            method: "PUT",
            body: {
                user_ids: ["100000000000000001"],
            },
        });

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.equal(response.body.message, "Error: Missing Authorization Header");
    });

    test("fails closed before single-user relationship mutation semantics can run", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/users/@me/relationships/bulk", {
            method: "PUT",
            body: {
                user_ids: ["100000000000000001"],
            },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: USER_BULK_RELATIONSHIPS_PUT_UNSUPPORTED_MESSAGE,
        });
    });

    test("uses an explicit unsupported bulk relationship API error", () => {
        const error = createUserBulkRelationshipsPutUnsupportedError();

        assert.equal(error.code, 0);
        assert.equal(error.httpStatus, 501);
        assert.equal(error.message, USER_BULK_RELATIONSHIPS_PUT_UNSUPPORTED_MESSAGE);
    });

    test("declares fail-closed route metadata ahead of the user-id route", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "relationships.ts"), "utf8");
        const bulkPutIndex = routeSource.indexOf('router.put(\n    "/bulk"');
        const singleUserPutIndex = routeSource.indexOf('router.put(\n    "/:user_id"');

        assert.notEqual(bulkPutIndex, -1);
        assert.notEqual(singleUserPutIndex, -1);
        assert.equal(bulkPutIndex < singleUserPutIndex, true);
        assert.match(routeSource, /summary:\s*"Bulk Replace Relationships"/);
        assert.match(routeSource, /xHyroM client route catalog/);
        assert.match(routeSource, /fails closed instead of creating, deleting, or rewriting relationships/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource.slice(bulkPutIndex, singleUserPutIndex), /requestBody|204:\s*\{/);
    });

    test("generates source catalog, missing-route, OpenAPI, manifest, and contract metadata", () => {
        const sourceCatalog = readJson<RouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: MissingRouteEntry[] }>(join("packages", "missing-routes", "missing.json"));
        const openapi = readJson<{ paths?: Record<string, { put?: OpenApiOperation; post?: unknown; patch?: unknown; delete?: unknown }> }>(join("assets", "openapi.json"));
        const manifest = readJson<{ entries?: ManifestEntry[] }>(join("assets", "testing-manifest.json"));
        const contracts = readJson<{ contracts?: ContractEntry[] }>(join("test", "generated", "http-contracts.json"));

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "PUT" && entry.route === "/users/@me/relationships/bulk");
        assert.equal(sourceEntry?.source, "src/api/routes/users/@me/relationships.ts");
        assert.equal(sourceEntry?.request_schema_ref, undefined);
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(hasMissingRoute(missingRoutes, "PUT"), false);
        assert.equal(hasMissingRoute(missingRoutes, "DELETE"), true);
        assert.equal(hasMissingRoute(missingRoutes, "PATCH"), true);
        assert.equal(hasMissingRoute(missingRoutes, "POST"), true);

        const operation = openapi.paths?.["/users/@me/relationships/bulk"]?.put;
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.requestBody, undefined);
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["204"], undefined);
        assert.equal(openapi.paths?.["/users/@me/relationships/bulk"]?.post, undefined);
        assert.equal(openapi.paths?.["/users/@me/relationships/bulk"]?.patch, undefined);
        assert.equal(openapi.paths?.["/users/@me/relationships/bulk"]?.delete, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:PUT:/users/@me/relationships/bulk");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/relationships.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 501]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === "api:http:PUT:/users/@me/relationships/bulk");
        assert.equal(contract?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [401, 501]);
    });
});

function setupAuthenticatedRoute() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/relationships", relationshipsRouter);
    app.use(ErrorHandler);
    return app;
}

function hasMissingRoute(missingRoutes: { missing_entries?: MissingRouteEntry[] }, method: string) {
    return missingRoutes.missing_entries?.some((entry) => entry.method === method && entry.route === "/users/@me/relationships/bulk") ?? false;
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), filePath), "utf8")) as T;
}

async function requestJson(app: express.Express, requestPath: string, options: { body?: unknown; method?: string } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });
        const text = await response.text();

        return {
            status: response.status,
            body: (text ? JSON.parse(text) : {}) as JsonObject,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
