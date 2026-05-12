/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
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
import { User } from "@spacebar/util";
import express from "express";
import premiumUsageRouter, { buildUserPremiumUsageResponse, PremiumUsageFlag } from "../../src/api/routes/users/@me/premium-usage";

const coveredManifestIds = ["api:http:GET:/users/@me/premium-usage/"];
const assignedSourcePath = "/users/@me/premium-usage";
const assignedRouteName = "GET_USERS__ME_PREMIUM_USAGE";

type JsonSchema = {
    $ref?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

describe("GET /users/@me/premium-usage", () => {
    test("declares the assigned current-user premium usage manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/premium-usage/"]);
        assert.equal(assignedSourcePath, "/users/@me/premium-usage");
        assert.equal(assignedRouteName, "GET_USERS__ME_PREMIUM_USAGE");
    });

    test("builds a narrow response from the persisted premium usage flags", () => {
        const response = buildUserPremiumUsageResponse({
            premium_usage_flags: PremiumUsageFlag.AnimatedAvatar | PremiumUsageFlag.ProfileBanner,
        });

        assert.deepEqual(response, {
            premium_usage_flags: 6,
            premium_discriminator: {
                used: false,
            },
            animated_avatar: {
                used: true,
            },
            profile_banner: {
                used: true,
            },
        });
    });

    test("returns a fresh default object when the user has no premium usage flags", () => {
        const first = buildUserPremiumUsageResponse({ premium_usage_flags: 0 });
        const second = buildUserPremiumUsageResponse({ premium_usage_flags: 0 });

        assert.deepEqual(first, {
            premium_usage_flags: 0,
            premium_discriminator: {
                used: false,
            },
            animated_avatar: {
                used: false,
            },
            profile_banner: {
                used: false,
            },
        });
        assert.notEqual(first, second);
        assert.notEqual(first.animated_avatar, second.animated_avatar);
    });

    test("reads only the current user's premium usage flags", async (t) => {
        let lookupOptions: unknown;
        t.mock.method(User, "findOneOrFail", async (options: unknown) => {
            lookupOptions = options;
            return {
                id: "100000000000000001",
                premium_usage_flags: PremiumUsageFlag.PremiumDiscriminator,
            } as User;
        });

        const response = await requestJson(createRouteApp(), "/users/@me/premium-usage");

        assert.equal(response.status, 200);
        assert.deepEqual(lookupOptions, {
            where: { id: "100000000000000001" },
            select: { id: true, premium_usage_flags: true },
        });
        assert.deepEqual(response.body, {
            premium_usage_flags: 1,
            premium_discriminator: {
                used: true,
            },
            animated_avatar: {
                used: false,
            },
            profile_banner: {
                used: false,
            },
        });
    });

    test("stays behind bearer authentication and leaves adjacent premium routes untouched", async () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "premium-usage.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get User Premium Usage"/);
        assert.match(routeSource, /body:\s*"UserPremiumUsageResponse"/);
        assert.match(routeSource, /body:\s*"APIErrorResponse"/);
        assert.doesNotMatch(routeSource, /router\.post\(/);
        assert.doesNotMatch(routeSource, /subscription|payment|virtual currency|store purchase/i);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/premium-usage"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/users/@me/premium-usage/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/premium-usage"), false);

        const response = await requestJson(createAuthenticatedRouteApp(), "/users/@me/premium-usage");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("generates response schema, route catalogs, contracts, suite coverage, and missing-route removal", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: unknown[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            join(process.cwd(), "packages", "missing-routes", "missing.json"),
        );
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    hasQuery?: boolean;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[] }[] }[] }>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.deepEqual(schemas.UserPremiumUsageFeatureResponse.required, ["used"]);
        assert.equal(schemas.UserPremiumUsageFeatureResponse.properties?.used?.type, "boolean");
        assert.deepEqual(schemas.UserPremiumUsageResponse.required?.sort(), ["animated_avatar", "premium_discriminator", "premium_usage_flags", "profile_banner"]);
        assert.equal(schemas.UserPremiumUsageResponse.properties?.premium_usage_flags?.type, "integer");
        assert.equal(schemas.UserPremiumUsageResponse.properties?.premium_discriminator?.$ref, "#/definitions/UserPremiumUsageFeatureResponse");
        assert.equal(schemas.UserPremiumUsageResponse.properties?.animated_avatar?.$ref, "#/definitions/UserPremiumUsageFeatureResponse");
        assert.equal(schemas.UserPremiumUsageResponse.properties?.profile_banner?.$ref, "#/definitions/UserPremiumUsageFeatureResponse");

        const route = openapi.paths?.["/users/@me/premium-usage/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserPremiumUsageResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.parameters?.length ?? 0, 0);
        assert.equal(openapi.paths?.["/users/@me/premium-usage/"]?.post, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "UserPremiumUsageResponse"],
                route: assignedSourcePath,
                route_name: assignedRouteName,
                source: "src/api/routes/users/@me/premium-usage.ts",
            },
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === assignedRouteName),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/premium-usage.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "UserPremiumUsageResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "UserPremiumUsageResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(coveredManifestIds[0]), true);
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/users/@me/premium-usage", premiumUsageRouter);
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedRouteApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/premium-usage", premiumUsageRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
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
