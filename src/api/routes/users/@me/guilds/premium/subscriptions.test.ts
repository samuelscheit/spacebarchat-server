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
import { isNoAuthorizationRoute } from "../../../../../middlewares/NoAuthorizationRoutes";

const requireModule = require;
const routeModulePath = require.resolve("./subscriptions");
const manifestId = "api:http:GET:/users/@me/guilds/premium/subscriptions/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/@me/guilds/premium/subscriptions", () => {
    test("declares authenticated applied guild boost subscription response metadata", (t) => {
        const harness = setupUserGuildPremiumSubscriptionsRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Applied Premium Guild Subscriptions",
            description:
                "Returns locally backed current-user guild premium subscriptions. Spacebar does not persist Discord guild boost subscription records yet, so the supported representation is an empty list.",
            responses: {
                200: {
                    body: "UserGuildPremiumSubscriptionsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays on the authenticated current-user route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/guilds/premium/subscriptions"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/guilds/premium/subscriptions"), false);
    });

    test("returns an empty list until current-user guild premium subscription records are persisted", async (t) => {
        const harness = setupUserGuildPremiumSubscriptionsRoute(t);

        const response = await requestJson(harness.app, "/users/@me/guilds/premium/subscriptions");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("generated artifacts own only the assigned GET route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "guilds", "premium", "subscriptions.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    items?: Record<string, unknown>;
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                    put?: unknown;
                    patch?: unknown;
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
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string }[] }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[] }[] }[] }>(path.join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(?:post|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /subscription-slots|cooldown/);

        assert.equal(schemas.UserGuildPremiumSubscriptionsResponse?.type, "array");
        assert.deepEqual(schemas.UserGuildPremiumSubscriptionsResponse?.items, {});

        const route = openapi.paths?.["/users/@me/guilds/premium/subscriptions/"];
        assert.equal(route?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserGuildPremiumSubscriptionsResponse");
        assert.equal(route?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.get?.security, [{ bearer: [] }]);
        assert.equal(route?.post, undefined);
        assert.equal(route?.put, undefined);
        assert.equal(route?.patch, undefined);
        assert.equal(route?.delete, undefined);

        const getSourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/guilds/premium/subscriptions");
        assert.equal(getSourceRoute?.route_name, "GET_USERS__ME_GUILDS_PREMIUM_SUBSCRIPTIONS");
        assert.equal(getSourceRoute?.source, "src/api/routes/users/@me/guilds/premium/subscriptions.ts");
        assert.equal(getSourceRoute?.response_schema_refs?.includes("UserGuildPremiumSubscriptionsResponse"), true);
        assert.equal(getSourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/guilds/premium/subscriptions"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/guilds/premium/subscriptions.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UserGuildPremiumSubscriptionsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401]);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === manifestId),
            true,
        );
        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(manifestId), true);
    });
});

type TestHarness = {
    app: express.Express;
    routeOptions: unknown[];
};

function setupUserGuildPremiumSubscriptionsRoute(t: TestContext): TestHarness {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./subscriptions");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/guilds/premium/subscriptions", routeModule.createUserGuildPremiumSubscriptionsRouter());

    return {
        app,
        get routeOptions() {
            return routeOptions;
        },
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

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8")) as T;
}
