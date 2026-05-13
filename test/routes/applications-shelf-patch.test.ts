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
import applicationShelfRouter, { APPLICATIONS_SHELF_UNSUPPORTED_MESSAGE, createApplicationsShelfUnsupportedError } from "../../src/api/routes/applications/shelf";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:PATCH:/applications/shelf/", "api:http:PUT:/applications/shelf/"];
const assignedPath = "/applications/shelf";

type JsonSchema = {
    $ref?: string;
};

describe("PATCH and PUT /applications/shelf", () => {
    test("declares the assigned manifest route ids and remains bearer-authenticated", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:PATCH:/applications/shelf/", "api:http:PUT:/applications/shelf/"]);
        assert.equal(isNoAuthorizationRoute("PATCH", "/api/v10/applications/shelf"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/applications/shelf"), false);
        assert.equal(isNoAuthorizationRoute("PUT", "/api/v10/applications/shelf"), false);

        const patchResponse = await requestJson(createRouteApp({ authentication: true }), "/applications/shelf", { method: "PATCH" });
        const putResponse = await requestJson(createRouteApp({ authentication: true }), "/applications/shelf", { method: "PUT" });

        assert.equal(patchResponse.status, 401);
        assert.equal((patchResponse.body as { code?: unknown }).code, 401);
        assert.equal(putResponse.status, 401);
        assert.equal((putResponse.body as { code?: unknown }).code, 401);
    });

    test("fails closed instead of mutating unsupported personalized shelf state", async () => {
        const unsupportedError = createApplicationsShelfUnsupportedError();

        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, APPLICATIONS_SHELF_UNSUPPORTED_MESSAGE);

        for (const method of ["PATCH", "PUT"]) {
            const response = await requestJson(createRouteApp(), "/applications/shelf", { method });

            assert.equal(response.status, 501);
            assert.deepEqual(response.body, {
                code: 0,
                message: APPLICATIONS_SHELF_UNSUPPORTED_MESSAGE,
            });
        }
    });

    test("declares generated artifacts for the owned PATCH and PUT methods", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "applications", "shelf.ts"), "utf8");
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: unknown;
                    patch?: {
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                        security?: unknown;
                    };
                    put?: {
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                path?: string;
                sourceFile?: string;
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
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };
        const contractTests = JSON.parse(readFileSync(join(process.cwd(), "test", "generated", "http-contracts.json"), "utf8")) as {
            contracts?: {
                manifestId?: string;
                authMode?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };

        assert.match(routeSource, /summary:\s*"Update Application Shelf"/);
        assert.match(routeSource, /summary:\s*"Replace Application Shelf"/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /router\.patch\(\s*["']\/["']/);
        assert.match(routeSource, /router\.put\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(get|post|delete|options)\(/);

        const patchRoute = openapi.paths?.["/applications/shelf/"]?.patch;
        assert.equal(patchRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(patchRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(patchRoute?.security, [{ bearer: [] }]);
        const putRoute = openapi.paths?.["/applications/shelf/"]?.put;
        assert.equal(putRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(putRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(putRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/applications/shelf/"]?.get, undefined);

        for (const coveredManifestId of coveredManifestIds) {
            const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
            assert.equal(manifestEntry?.path, `${assignedPath}/`);
            assert.equal(manifestEntry?.sourceFile, "src/api/routes/applications/shelf.ts");
            assert.equal(manifestEntry?.authMode, "bearer");
            assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
            assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 501]);
        }

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "PATCH" && entry.route === assignedPath);
        assert.equal(sourceEntry?.route_name, "PATCH_APPLICATIONS_SHELF");
        assert.equal(sourceEntry?.source, "src/api/routes/applications/shelf.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);
        const putSourceEntry = sourceCatalog.find((entry) => entry.method === "PUT" && entry.route === assignedPath);
        assert.equal(putSourceEntry?.route_name, "PUT_APPLICATIONS_SHELF");
        assert.equal(putSourceEntry?.source, "src/api/routes/applications/shelf.ts");
        assert.deepEqual(putSourceEntry?.response_schema_refs, ["APIErrorResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "GET" && entry.route === assignedPath),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === assignedPath && entry.route_name === "APPLICATIONS_SHELF"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedPath && entry.route_name === "APPLICATIONS_SHELF"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === assignedPath && entry.route_name === "APPLICATIONS_SHELF"),
            false,
        );

        for (const coveredManifestId of coveredManifestIds) {
            const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestId);
            assert.equal(contract?.authMode, "bearer");
            assert.equal(contract?.routeMetadata?.responses?.includes("APIErrorResponse"), true);
            assert.deepEqual(contract?.routeMetadata?.responseStatuses, [401, 501]);
        }
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    else {
        app.use((req, _res, next) => {
            req.user_id = "user";
            next();
        });
    }
    app.use("/applications/shelf", applicationShelfRouter);
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, path: string, options: { method?: string } = {}) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: options.method ?? "PATCH",
        });

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
