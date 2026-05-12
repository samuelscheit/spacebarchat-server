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
import googlePlayVerifyPurchaseTokenRouter, {
    GOOGLE_PLAY_VERIFY_PURCHASE_TOKEN_UNSUPPORTED_MESSAGE,
    createGooglePlayVerifyPurchaseTokenRouter,
    type GooglePlayVerifyPurchaseTokenRequest,
} from "../../src/api/routes/google-play/verify-purchase-token";

const coveredManifestIds = ["api:http:POST:/google-play/verify-purchase-token/"];
const assignedMissingRoute = "/google-play/verify-purchase-token";
const assignedMissingRouteName = "VERIFY_PURCHASE";
const assignedSourceRouteName = "POST_GOOGLE_PLAY_VERIFY_PURCHASE_TOKEN";

type JsonSchema = {
    additionalProperties?: boolean;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
    minLength?: number;
    pattern?: string;
};

describe("POST /google-play/verify-purchase-token", () => {
    test("declares the assigned manifest route id and xHyroM route identity", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:POST:/google-play/verify-purchase-token/"]);
        assert.equal(assignedMissingRoute, "/google-play/verify-purchase-token");
        assert.equal(assignedMissingRouteName, "VERIFY_PURCHASE");
    });

    test("stays behind bearer authentication and leaves sibling Google Play routes untouched", async () => {
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/google-play/verify-purchase-token"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/google-play/verify-purchase-token/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/google-play/validate-purchase"), false);

        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "google-play", "verify-purchase-token.ts"), "utf8");
        assert.match(routeSource, /summary:\s*"Verify Google Play Purchase Token"/);
        assert.match(routeSource, /requestBody:\s*"GooglePlayVerifyPurchaseTokenSchema"/);
        assert.match(routeSource, /coerceRequestBody:\s*false/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /validate-purchase|downgrade-subscription/);
        assert.doesNotMatch(routeSource, /router\.(get|put|patch|delete)\(/);

        const response = await requestJson(createRouteApp({ authentication: true }), "/google-play/verify-purchase-token", {
            method: "POST",
            body: { purchase_token: "purchase-token" },
        });

        assert.equal(response.status, 401);
        assert.equal(response.body?.code, 401);
        assert.equal(response.body?.message, "Error: Missing Authorization Header");
    });

    test("rejects invalid purchase-token bodies before provider handling", async () => {
        const app = createRouteApp({
            verifyPurchaseToken: async () => {
                throw new Error("provider should not be called for invalid body");
            },
        });

        const missingToken = await requestJson(app, "/google-play/verify-purchase-token", {
            method: "POST",
            body: {},
        });
        const emptyToken = await requestJson(app, "/google-play/verify-purchase-token", {
            method: "POST",
            body: { purchase_token: "" },
        });
        const coercedToken = await requestJson(app, "/google-play/verify-purchase-token", {
            method: "POST",
            body: { purchase_token: 123 },
        });

        for (const response of [missingToken, emptyToken, coercedToken]) {
            assert.equal(response.status, 400);
            assert.equal(response.body?.code, 50035);
            assert.equal(response.body?.message, "Invalid Form Body");
            assert.equal(typeof response.body?.errors, "object");
        }
    });

    test("passes validated token metadata to a configured verifier and returns no content", async () => {
        const calls: GooglePlayVerifyPurchaseTokenRequest[] = [];
        const response = await requestJson(
            createRouteApp({
                verifyPurchaseToken: async (request) => {
                    calls.push(request);
                },
            }),
            "/google-play/verify-purchase-token",
            {
                method: "POST",
                body: {
                    purchase_token: "purchase-token",
                    package_name: "com.discord",
                    product_id: "premium_monthly",
                    sku_id: "100000000000000001",
                    subscription_plan_id: "100000000000000002",
                },
            },
        );

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0], {
            user_id: "100000000000000010",
            purchase_token: "purchase-token",
            package_name: "com.discord",
            product_id: "premium_monthly",
            sku_id: "100000000000000001",
            subscription_plan_id: "100000000000000002",
            ip: "127.0.0.1",
            userAgent: "google-play-route-test",
        });
    });

    test("fails closed by default instead of granting unverified purchase benefits", async () => {
        const response = await requestJson(createRouteApp(), "/google-play/verify-purchase-token", {
            method: "POST",
            body: { purchase_token: "purchase-token" },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: GOOGLE_PLAY_VERIFY_PURCHASE_TOKEN_UNSUPPORTED_MESSAGE,
        });
    });

    test("generates schema, OpenAPI, source catalog, manifest, contracts, and missing-route removal", () => {
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    post?: {
                        requestBody?: {
                            content?: Record<string, { schema?: { $ref?: string } }>;
                        };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    get?: unknown;
                    put?: unknown;
                    patch?: unknown;
                    delete?: unknown;
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    requestBody?: string;
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
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{
            summary?: { totalGroups?: number; totalSuites?: number };
        }>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        const schema = schemas.GooglePlayVerifyPurchaseTokenSchema;
        assert.equal(schema.type, "object");
        assert.equal(schema.additionalProperties, false);
        assert.deepEqual(schema.required, ["purchase_token"]);
        assert.equal(schema.properties?.purchase_token?.type, "string");
        assert.equal(schema.properties?.purchase_token?.minLength, 1);
        assert.equal(schema.properties?.package_name?.type, "string");
        assert.equal(schema.properties?.package_name?.minLength, 1);
        assert.equal(schema.properties?.product_id?.type, "string");
        assert.equal(schema.properties?.product_id?.minLength, 1);
        assert.equal(schema.properties?.sku_id?.pattern, "^[0-9]+$");
        assert.equal(schema.properties?.subscription_plan_id?.pattern, "^[0-9]+$");

        const operation = openapi.paths?.["/google-play/verify-purchase-token/"]?.post;
        assert.equal(operation?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GooglePlayVerifyPurchaseTokenSchema");
        assert.equal(operation?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/google-play/verify-purchase-token/"]?.get, undefined);
        assert.equal(openapi.paths?.["/google-play/verify-purchase-token/"]?.put, undefined);
        assert.equal(openapi.paths?.["/google-play/verify-purchase-token/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/google-play/verify-purchase-token/"]?.delete, undefined);

        assert.deepEqual(
            sourceCatalog.find((entry) => entry.method === "POST" && entry.route === assignedMissingRoute),
            {
                method: "POST",
                request_schema_ref: "GooglePlayVerifyPurchaseTokenSchema",
                response_schema_refs: ["APIErrorResponse"],
                route: assignedMissingRoute,
                route_name: assignedSourceRouteName,
                source: "src/api/routes/google-play/verify-purchase-token.ts",
            },
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedMissingRoute && entry.route_name === assignedMissingRouteName),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/google-play/verify-purchase-token.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "GooglePlayVerifyPurchaseTokenSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 400, 401, 501]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.requestBody, "GooglePlayVerifyPurchaseTokenSchema");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [204, 400, 401, 501]);
        assert.equal((suiteCoverage.summary?.totalGroups ?? 0) > 0, true);
        assert.equal((suiteCoverage.summary?.totalSuites ?? 0) > 0, true);
    });
});

function createRouteApp(
    dependencies: {
        authentication?: boolean;
        verifyPurchaseToken?: (request: GooglePlayVerifyPurchaseTokenRequest) => Promise<void>;
    } = {},
) {
    const app = express();

    app.use(express.json());
    if (dependencies.authentication) {
        app.use(Authentication);
    } else {
        app.use((req, _res, next) => {
            req.user_id = "100000000000000010";
            next();
        });
    }
    app.use(
        "/google-play/verify-purchase-token",
        dependencies.verifyPurchaseToken
            ? createGooglePlayVerifyPurchaseTokenRouter({
                  verifyPurchaseToken: dependencies.verifyPurchaseToken,
              })
            : googlePlayVerifyPurchaseTokenRouter,
    );
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string, options: { method?: string; body?: unknown } = {}) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") {
            throw new Error("Expected HTTP server to listen on a TCP port");
        }
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: {
                ...(options.body == undefined ? {} : { "content-type": "application/json" }),
                "user-agent": "google-play-route-test",
            },
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
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}
