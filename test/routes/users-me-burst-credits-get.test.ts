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
import burstCreditsRouter, { createCurrentUserBurstCreditsRouter, getCurrentUserBurstCreditBalance } from "../../src/api/routes/users/@me/burst-credits";

const coveredManifestIds = ["api:http:GET:/users/@me/burst-credits/"];
const assignedSourcePath = "/users/@me/burst-credits";
const assignedSourceRouteName = "GET_USERS__ME_BURST_CREDITS";
const xhyromRouteName = "BURST_CREDIT_BALANCE";

type JsonSchema = {
    $ref?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
    minimum?: number;
};

describe("GET /users/@me/burst-credits", () => {
    test("documents the assigned route identity, source evidence, and bearer auth boundary", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/burst-credits/"]);
        assert.equal(assignedSourcePath, "/users/@me/burst-credits");
        assert.equal(assignedSourceRouteName, "GET_USERS__ME_BURST_CREDITS");
        assert.equal(xhyromRouteName, "BURST_CREDIT_BALANCE");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/burst-credits"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/users/@me/burst-credits/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/burst-credits"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/burst-credits");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns the narrow locally backed current-user burst-credit balance", async () => {
        assert.deepEqual(getCurrentUserBurstCreditBalance("100000000000000001"), { balance: 0 });
        assert.notEqual(
            getCurrentUserBurstCreditBalance("100000000000000001"),
            getCurrentUserBurstCreditBalance("100000000000000001"),
            "callers should receive a fresh balance object",
        );

        const response = await requestJson(createRouteApp(), "/users/@me/burst-credits");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { balance: 0 });
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned route", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "burst-credits.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
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
        const xhyromCatalog = readJson<{ method?: string; route?: string; route_name?: string; source?: string }[]>(
            join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.xhyrom.catalog.json"),
        );
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                path?: string;
                routeMetadata?: {
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
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[] }[] }[] }>(join(process.cwd(), "test", "generated", "suite-coverage.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Get Burst Credit Balance"/);
        assert.match(routeSource, /description:\s*"Returns the current user's locally backed burst-credit balance without fabricating Discord private client state\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"BurstCreditBalanceResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(post|patch|put|delete)\(/);
        assert.doesNotMatch(routeSource, /billing|subscription|payment|premium|nitro|upload|entitlement|virtual-currency/i);

        assert.equal(schemas.BurstCreditBalanceResponse.type, "object");
        assert.deepEqual(schemas.BurstCreditBalanceResponse.required, ["balance"]);
        assert.equal(schemas.BurstCreditBalanceResponse.properties?.balance?.type, "integer");
        assert.equal(schemas.BurstCreditBalanceResponse.properties?.balance?.minimum, 0);

        const route = openapi.paths?.["/users/@me/burst-credits/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/BurstCreditBalanceResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/users/@me/burst-credits/"]?.post, undefined);

        const xhyromEntries = xhyromCatalog.filter((entry) => entry.route === assignedSourcePath);
        assert.deepEqual(xhyromEntries.map((entry) => entry.method).sort(), ["GET", "HEAD", "OPTIONS"]);
        assert.equal(
            xhyromEntries.some((entry) => entry.method === "GET" && entry.route_name === xhyromRouteName),
            true,
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(sourceEntry?.route_name, assignedSourceRouteName);
        assert.equal(sourceEntry?.source, "src/api/routes/users/@me/burst-credits.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "BurstCreditBalanceResponse"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/users/@me/burst-credits/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/burst-credits.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "BurstCreditBalanceResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/users/@me/burst-credits/");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "BurstCreditBalanceResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(coveredManifestIds[0]), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === xhyromRouteName),
            false,
        );
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/users/@me/burst-credits", createCurrentUserBurstCreditsRouter());
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/burst-credits", burstCreditsRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
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
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
