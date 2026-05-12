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
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express from "express";
import { isNoAuthorizationRoute } from "../../../middlewares/NoAuthorizationRoutes";

const requireModule = require;
const routeModulePath = require.resolve("./entitlements");

const manifestId = "api:http:GET:/users/@me/entitlements/gift-codes";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/@me/entitlements/gift-codes", () => {
    test("declares authenticated metadata without changing adjacent gift routes", (t) => {
        const harness = setupUserEntitlementsRoute(t);

        assert.deepEqual(harness.routeOptions[1], {
            summary: "Get User Gift Codes",
            description: "Returns locally backed gift codes created by the current user without exposing application batch gift codes or fabricating Discord commerce state.",
            query: {
                sku_ids: {
                    type: "array",
                    description: "SKU IDs to filter user-created gift codes by when backed by local user gift-code state.",
                },
                subscription_plan_id: {
                    type: "string",
                    description: "Subscription plan ID to filter user-created gift codes by when backed by local user gift-code state.",
                },
            },
            responses: {
                200: {
                    body: "UserEntitlementGiftCodesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
        assert.deepEqual(harness.routeOptions[2], {
            responses: {
                200: {
                    body: "UserEntitlementGiftsResponse",
                },
            },
        });
    });

    test("stays on the authenticated route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/entitlements/gift-codes"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/entitlements/gift-codes"), false);
    });

    test("returns no user-created gift codes without fabricating application batch codes", async (t) => {
        const harness = setupUserEntitlementsRoute(t);

        const response = await requestJson(harness.app, "/users/@me/entitlements/gift-codes?sku_ids=100000000000000001&subscription_plan_id=100000000000000002");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("generated artifacts own only GET for current-user gift codes", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "entitlements.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    items?: { $ref?: string };
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; schema?: { type?: string } }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                    delete?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    hasQuery?: boolean;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string }[] }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; testFiles?: string[]; manifestIds?: string[] }[] }[] }>(
            path.join("test", "generated", "suite-coverage.json"),
        );

        assert.match(routeSource, /router\.get\(\s*["']\/gift-codes["']/);
        assert.doesNotMatch(routeSource, /router\.post\(\s*["']\/gift-codes["']/);
        assert.doesNotMatch(routeSource, /router\.delete\(\s*["']\/gift-codes/);

        assert.equal(schemas.UserEntitlementGiftCodesResponse?.type, "array");
        assert.equal(schemas.UserEntitlementGiftCodesResponse?.items?.$ref, "#/definitions/GiftCodeResponse");

        const route = openapi.paths?.["/users/@me/entitlements/gift-codes"];
        assert.equal(route?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserEntitlementGiftCodesResponse");
        assert.equal(route?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.get?.parameters?.find((parameter) => parameter.name === "sku_ids")?.schema?.type, "array");
        assert.equal(route?.get?.parameters?.find((parameter) => parameter.name === "subscription_plan_id")?.schema?.type, "string");
        assert.deepEqual(route?.get?.security, [{ bearer: [] }]);
        assert.equal(route?.post, undefined);
        assert.equal(route?.delete, undefined);

        const getSourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/entitlements/gift-codes");
        assert.equal(getSourceRoute?.route_name, "GET_USERS__ME_ENTITLEMENTS_GIFT_CODES");
        assert.equal(getSourceRoute?.source, "src/api/routes/users/@me/entitlements.ts");
        assert.equal(getSourceRoute?.response_schema_refs?.includes("UserEntitlementGiftCodesResponse"), true);
        assert.equal(getSourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/entitlements/gift-codes"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/entitlements/gift-codes"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === "/users/@me/entitlements/gift-codes/{param}"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/entitlements.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UserEntitlementGiftCodesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401]);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === manifestId),
            true,
        );
        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(manifestId), true);
        assert.equal(usersSuite?.testFiles?.includes("test/scenarios/users-entitlements-gifts.test.ts"), true);
    });
});

type TestHarness = {
    app: express.Express;
    routeOptions: unknown[];
};

function setupUserEntitlementsRoute(t: TestContext): TestHarness {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./entitlements");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/entitlements", routeModule.createUserEntitlementsRouter());

    return {
        app,
        routeOptions,
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

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

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as T;
}
