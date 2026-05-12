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
import premiumMarketingRouter, { listPremiumMarketingComponents } from "../../src/api/routes/premium-marketing";

const coveredManifestIds = ["api:http:GET:/premium-marketing/"];
const assignedSourcePath = "/premium-marketing";
const assignedGeneratedRouteName = "GET_PREMIUM_MARKETING";
const assignedTargetRouteName = "PREMIUM_MARKETING";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

describe("GET /premium-marketing", () => {
    test("documents the assigned route identity and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/premium-marketing/"]);
        assert.equal(assignedSourcePath, "/premium-marketing");
        assert.equal(assignedGeneratedRouteName, "GET_PREMIUM_MARKETING");
        assert.equal(assignedTargetRouteName, "PREMIUM_MARKETING");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/premium-marketing"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/premium-marketing/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/premium-marketing"), false);

        const response = await requestJson(createAuthenticatedApp(), "/premium-marketing");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns a fresh empty component list without fabricating private marketing state", async () => {
        assert.deepEqual(listPremiumMarketingComponents(), []);
        assert.notEqual(listPremiumMarketingComponents(), listPremiumMarketingComponents(), "callers should receive a fresh component list");

        const response = await requestJson(createRouteApp(), "/premium-marketing");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("declares narrow source-backed metadata and leaves adjacent marketing mutation routes untouched", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "premium-marketing.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Premium Marketing"/);
        assert.match(routeSource, /body:\s*"PremiumMarketingResponse"/);
        assert.match(routeSource, /body:\s*"APIErrorResponse"/);
        assert.doesNotMatch(routeSource, /router\.post\(/);
        assert.doesNotMatch(routeSource, /billing|subscription|sku|purchase|entitlement|promotion_id|campaign/i);
    });

    test("generates response schema, route catalogs, contracts, and missing-route movement", () => {
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
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string; sources?: string[] }[] }>(
            join(process.cwd(), "packages", "missing-routes", "missing.json"),
        );
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                coverage?: {
                    policyId?: string;
                    testTier?: string;
                };
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
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
                testTier?: string;
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));

        assert.equal(schemas.PremiumMarketingResponse.type, "array");
        assert.equal(schemas.PremiumMarketingResponse.items?.$ref, "#/definitions/PromotionMarketingComponentResponse");
        assert.deepEqual(schemas.PromotionMarketingComponentResponse.required?.sort(), ["component_type", "id", "promotion_id", "properties"]);
        assert.equal(schemas.PromotionMarketingComponentResponse.properties?.properties?.type, "string");

        const route = openapi.paths?.["/premium-marketing/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PremiumMarketingResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.parameters?.length ?? 0, 0);
        assert.equal(openapi.paths?.["/premium-marketing/"]?.post, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath),
            {
                method: "GET",
                response_schema_refs: ["APIErrorResponse", "PremiumMarketingResponse"],
                route: assignedSourcePath,
                route_name: assignedGeneratedRouteName,
                source: "src/api/routes/premium-marketing.ts",
            },
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "POST" && entry.route === assignedSourcePath),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === assignedTargetRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedSourcePath && entry.route_name === assignedTargetRouteName),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/premium-marketing.ts");
        assert.equal(manifestEntry?.coverage?.policyId, "api-public-contract");
        assert.equal(manifestEntry?.coverage?.testTier, "contract");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "PremiumMarketingResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/premium-marketing/");
        assert.equal(contract?.testTier, "contract");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "PremiumMarketingResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/premium-marketing", premiumMarketingRouter);
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/premium-marketing", premiumMarketingRouter);
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
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
