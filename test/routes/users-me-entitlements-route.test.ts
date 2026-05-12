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
import entitlementsRouter, { createUserEntitlementsRouter, getCurrentUserEntitlements } from "../../src/api/routes/users/@me/entitlements";

const coveredManifestIds = ["api:http:GET:/users/@me/entitlements/"];
const assignedSourcePath = "/users/@me/entitlements";
const assignedRouteName = "GET_USERS__ME_ENTITLEMENTS";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    type?: string | string[];
};

function createRouteApp(router = createUserEntitlementsRouter()) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/users/@me/entitlements", router);
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/entitlements", createUserEntitlementsRouter());
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

describe("GET /users/@me/entitlements", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/entitlements/"]);
        assert.equal(assignedSourcePath, "/users/@me/entitlements");
        assert.equal(assignedRouteName, "GET_USERS__ME_ENTITLEMENTS");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/entitlements?with_sku=false&with_application=false"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/users/@me/entitlements/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/entitlements?with_sku=false&with_application=false&entitlement_type=11&exclude_ended=true");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns only the locally backed current-user entitlement representation", async () => {
        assert.deepEqual(getCurrentUserEntitlements(), []);
        assert.notEqual(getCurrentUserEntitlements(), getCurrentUserEntitlements(), "callers should receive a fresh entitlement array");

        const response = await requestJson(createRouteApp(), "/users/@me/entitlements?with_sku=false&with_application=false&entitlement_type=11&exclude_ended=true");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("does not change the adjacent giftable-entitlements subroute", async () => {
        const response = await requestJson(createRouteApp(entitlementsRouter), "/users/@me/entitlements/gifts");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "entitlements.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            components?: {
                schemas?: Record<string, JsonSchema>;
            };
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; required?: boolean; schema?: JsonSchema }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
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
                    hasQuery?: boolean;
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

        assert.match(routeSource, /summary:\s*"Get User Entitlements"/);
        assert.match(routeSource, /description:\s*"Returns locally backed current-user entitlements without fabricating Discord commerce state\."/);
        assert.match(routeSource, /with_sku:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /with_application:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /entitlement_type:\s*\{\s*type:\s*"integer"/s);
        assert.match(routeSource, /exclude_ended:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"UserEntitlementsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.UserEntitlementsResponse.type, "array");
        assert.deepEqual(schemas.UserEntitlementsResponse.items, {});
        assert.equal(openapi.components?.schemas?.UserEntitlementsResponse?.type, "array");

        const route = openapi.paths?.["/users/@me/entitlements/"]?.get;
        for (const name of ["with_sku", "with_application", "entitlement_type", "exclude_ended"]) {
            assert.equal(
                route?.parameters?.some((parameter) => parameter.name === name && parameter.in === "query"),
                true,
            );
        }
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserEntitlementsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/users/@me/entitlements/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/entitlements.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UserEntitlementsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/users/@me/entitlements.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "UserEntitlementsResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === assignedRouteName),
            false,
        );

        const contract = contractTests.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse", "UserEntitlementsResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 401]);
    });
});
