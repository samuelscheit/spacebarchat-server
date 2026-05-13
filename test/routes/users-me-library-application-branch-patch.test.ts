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
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import libraryRouter, {
    USER_LIBRARY_APPLICATION_BRANCH_UPDATE_UNSUPPORTED_MESSAGE,
    createUserLibraryApplicationBranchUpdateUnsupportedError,
    parseUserLibraryApplicationBranchApplicationId,
    parseUserLibraryApplicationBranchBranchId,
    updateUserLibraryApplicationBranch,
} from "../../src/api/routes/users/@me/library";

const assignedMissingRoute = "/users/@me/library/{param}/{param}";
const assignedMissingRouteName = "LIBRARY_APPLICATION_BRANCH";
const implementedSourceRoute = "/users/@me/library/{application_id}/{branch_id}";
const implementedSourceRouteName = "PATCH_USERS__ME_LIBRARY_APPLICATION_ID_BRANCH_ID";
const coveredManifestId = "api:http:PATCH:/users/@me/library/:application_id/:branch_id";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean;
    minimum?: number;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

describe("PATCH /users/@me/library/:application_id/:branch_id", () => {
    test("declares the assigned route identity and remains bearer-authenticated", async () => {
        assert.equal(assignedMissingRoute, "/users/@me/library/{param}/{param}");
        assert.equal(assignedMissingRouteName, "LIBRARY_APPLICATION_BRANCH");
        assert.equal(coveredManifestId, "api:http:PATCH:/users/@me/library/:application_id/:branch_id");
        assert.equal(isNoAuthorizationRoute("PATCH", "/api/v10/users/@me/library/100000000000000001/100000000000000002"), false);
        assert.equal(isNoAuthorizationRoute("DELETE", "/api/v10/users/@me/library/100000000000000001/100000000000000002"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/users/@me/library/100000000000000001/100000000000000002/installed"), false);

        const response = await requestJson(createRouteApp({ authentication: true }), "/users/@me/library/100000000000000001/100000000000000002", {
            body: { flags: 1 },
        });

        assert.equal(response.status, 401);
        assert.equal(response.body?.code, 401);
    });

    test("rejects invalid request bodies before unsupported library-state handling", async () => {
        const app = createRouteApp();

        const stringFlags = await requestJson(app, "/users/@me/library/100000000000000001/100000000000000002", {
            body: { flags: "1" },
        });
        const negativeFlags = await requestJson(app, "/users/@me/library/100000000000000001/100000000000000002", {
            body: { flags: -1 },
        });
        const extraField = await requestJson(app, "/users/@me/library/100000000000000001/100000000000000002", {
            body: { flags: 1, installed: true },
        });

        for (const response of [stringFlags, negativeFlags, extraField]) {
            assert.equal(response.status, 400);
            assert.equal(response.body?.code, 50035);
            assert.equal(response.body?.message, "Invalid Form Body");
            assert.equal(typeof response.body?.errors, "object");
        }
    });

    test("validates route identifiers and fails closed without mutating fabricated library data", async () => {
        assert.equal(parseUserLibraryApplicationBranchApplicationId("100000000000000001"), "100000000000000001");
        assert.equal(parseUserLibraryApplicationBranchBranchId("100000000000000002"), "100000000000000002");
        assert.throws(
            () => parseUserLibraryApplicationBranchApplicationId("not-a-snowflake"),
            (error) => {
                assert.equal((error as { code?: unknown }).code, DiscordApiErrors.UNKNOWN_APPLICATION.code);
                return true;
            },
        );
        assert.throws(
            () => parseUserLibraryApplicationBranchBranchId("not-a-snowflake"),
            (error) => {
                assert.equal((error as { code?: unknown }).code, DiscordApiErrors.UNKNOWN_BRANCH.code);
                return true;
            },
        );

        const unsupportedError = createUserLibraryApplicationBranchUpdateUnsupportedError();
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, USER_LIBRARY_APPLICATION_BRANCH_UPDATE_UNSUPPORTED_MESSAGE);
        assert.throws(
            () =>
                updateUserLibraryApplicationBranch({
                    user_id: "100000000000000010",
                    application_id: "100000000000000001",
                    branch_id: "100000000000000002",
                    flags: 1,
                }),
            (error) => {
                assert.equal((error as { httpStatus?: unknown }).httpStatus, 501);
                assert.equal((error as { message?: unknown }).message, USER_LIBRARY_APPLICATION_BRANCH_UPDATE_UNSUPPORTED_MESSAGE);
                return true;
            },
        );

        const invalidApplicationResponse = await requestJson(createRouteApp(), "/users/@me/library/not-a-snowflake/100000000000000002", {
            body: { flags: 1 },
        });
        assert.equal(invalidApplicationResponse.status, 404);
        assert.deepEqual(invalidApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });

        const invalidBranchResponse = await requestJson(createRouteApp(), "/users/@me/library/100000000000000001/not-a-snowflake", {
            body: { flags: 1 },
        });
        assert.equal(invalidBranchResponse.status, 400);
        assert.deepEqual(invalidBranchResponse.body, {
            code: DiscordApiErrors.UNKNOWN_BRANCH.code,
            message: DiscordApiErrors.UNKNOWN_BRANCH.message,
        });

        const response = await requestJson(createRouteApp(), "/users/@me/library/100000000000000001/100000000000000002", {
            body: { flags: 1 },
        });
        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: USER_LIBRARY_APPLICATION_BRANCH_UPDATE_UNSUPPORTED_MESSAGE,
        });
    });

    test("generates schema, OpenAPI, source catalog, manifest, contracts, and assigned missing-route removal", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "library.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: unknown;
                    patch?: {
                        requestBody?: {
                            content?: Record<string, { schema?: JsonSchema }>;
                        };
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                        security?: unknown;
                    };
                    delete?: unknown;
                    post?: unknown;
                }
            >;
        }>(join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{
            missing?: number;
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                path?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join("assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{
            groups?: { suites?: { manifestIds?: string[]; testFiles?: string[] }[] }[];
        }>(join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.patch\(\s*["']\/:application_id\/:branch_id["']/);
        assert.match(routeSource, /requestBody:\s*"LibraryApplicationBranchModifySchema"/);
        assert.match(routeSource, /coerceRequestBody:\s*false/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(delete|post)\(/);

        const schema = schemas.LibraryApplicationBranchModifySchema;
        assert.equal(schema.type, "object");
        assert.equal(schema.additionalProperties, false);
        assert.deepEqual(schema.required, undefined);
        assert.equal(schema.properties?.flags?.type, "integer");
        assert.equal(schema.properties?.flags?.minimum, 0);

        const operation = openapi.paths?.["/users/@me/library/{application_id}/{branch_id}"]?.patch;
        assert.equal(operation?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/LibraryApplicationBranchModifySchema");
        assert.equal(operation?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/users/@me/library/{application_id}/{branch_id}"]?.delete, undefined);
        assert.equal(openapi.paths?.["/users/@me/library/{application_id}/{branch_id}/installed"]?.post, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "PATCH" && entry.route === implementedSourceRoute),
            {
                method: "PATCH",
                request_schema_ref: "LibraryApplicationBranchModifySchema",
                response_schema_refs: ["APIErrorResponse"],
                route: implementedSourceRoute,
                route_name: implementedSourceRouteName,
                source: "src/api/routes/users/@me/library.ts",
            },
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "DELETE" && entry.route === implementedSourceRoute),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "POST" && entry.route === "/users/@me/library/{application_id}/{branch_id}/installed"),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PATCH" && entry.route === assignedMissingRoute && entry.route_name === assignedMissingRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === assignedMissingRoute && entry.route_name === assignedMissingRouteName),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "POST" && entry.route === "/users/@me/library/{param}/{param}/installed" && entry.route_name === "LIBRARY_APPLICATION_INSTALLED",
            ),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, "/users/@me/library/:application_id/:branch_id");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/library.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "LibraryApplicationBranchModifySchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [400, 401, 404, 501]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.sourceFile, "src/api/routes/users/@me/library.ts");
        assert.equal(contract?.routeMetadata?.requestBody, "LibraryApplicationBranchModifySchema");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [400, 401, 404, 501]);
        assert.equal(
            suiteCoverage.groups?.some((group) =>
                group.suites?.some(
                    (suite) => suite.manifestIds?.includes(coveredManifestId) && suite.testFiles?.includes("test/routes/users-me-library-application-branch-patch.test.ts"),
                ),
            ),
            true,
        );
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();

    app.use(express.json());
    if (options.authentication) {
        app.use(Authentication);
    } else {
        app.use((req, _res, next) => {
            req.user_id = "100000000000000010";
            next();
        });
    }
    app.use("/users/@me/library", libraryRouter);
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string, options: { body?: unknown } = {}) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") {
            throw new Error("Expected HTTP server to listen on a TCP port");
        }
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`, {
            method: "PATCH",
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? {} : { "content-type": "application/json" },
        });
        const text = await response.text();

        return {
            status: response.status,
            body: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), filePath), "utf8")) as T;
}
