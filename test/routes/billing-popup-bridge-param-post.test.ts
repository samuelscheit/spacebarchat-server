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
import path from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import billingPopupBridgeRouter, {
    BILLING_POPUP_BRIDGE_UNSUPPORTED_MESSAGE,
    INVALID_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_MESSAGE,
    assertBillingPopupBridgePaymentSourceType,
    createBillingPopupBridgeUnsupportedError,
    createInvalidBillingPopupBridgePaymentSourceTypeError,
} from "../../src/api/routes/billing/popup-bridge/#payment_source_type";

const coveredManifestId = "api:http:POST:/billing/popup-bridge/:payment_source_type/";
const assignedSourcePath = "/billing/popup-bridge/{payment_source_type}";
const assignedMissingPath = "/billing/popup-bridge/{param}";
const assignedRouteName = "POST_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE";

type JsonSchema = {
    $ref?: string;
};

describe("POST /billing/popup-bridge/:payment_source_type", () => {
    test("declares the assigned manifest route id and remains bearer-authenticated", async () => {
        assert.equal(coveredManifestId, "api:http:POST:/billing/popup-bridge/:payment_source_type/");
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/billing/popup-bridge/2"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/billing/popup-bridge/2"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/billing/popup-bridge/2/callback"), false);

        const response = await requestJson(createRouteApp({ authentication: true }), "/billing/popup-bridge/2");

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.equal(response.body.message, "Error: Missing Authorization Header");
    });

    test("validates documented payment source type path values before failing closed", async () => {
        assert.doesNotThrow(() => assertBillingPopupBridgePaymentSourceType("1"));
        assert.doesNotThrow(() => assertBillingPopupBridgePaymentSourceType("19"));
        assert.throws(() => assertBillingPopupBridgePaymentSourceType("0"), {
            message: INVALID_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_MESSAGE,
        });
        assert.throws(() => assertBillingPopupBridgePaymentSourceType("paypal"), {
            message: INVALID_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_MESSAGE,
        });

        const invalidError = createInvalidBillingPopupBridgePaymentSourceTypeError();
        assert.equal(invalidError.code, 0);
        assert.equal(invalidError.httpStatus, 400);
        assert.equal(invalidError.message, INVALID_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_MESSAGE);

        const response = await requestJson(createRouteApp(), "/billing/popup-bridge/paypal");
        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 0,
            message: INVALID_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_MESSAGE,
        });
    });

    test("fails closed instead of returning synthetic provider callback state", async () => {
        const unsupportedError = createBillingPopupBridgeUnsupportedError();
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.message, BILLING_POPUP_BRIDGE_UNSUPPORTED_MESSAGE);

        const response = await requestJson(createRouteApp(), "/billing/popup-bridge/2");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: BILLING_POPUP_BRIDGE_UNSUPPORTED_MESSAGE,
        });
    });

    test("documents route metadata and does not implement popup bridge callback siblings", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "billing", "popup-bridge", "#payment_source_type.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Create Billing Popup Bridge"/);
        assert.match(routeSource, /fails closed instead of returning an unusable synthetic state token/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.doesNotMatch(routeSource, /state:\s*crypto|randomUUID|randomBytes/);
        assert.doesNotMatch(routeSource, /router\.(get|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /router\.(?:get|post|put|patch|delete)\(\s*"\/callback/);
    });

    test("generates source catalog, missing-route, OpenAPI, testing manifest, contract, and suite coverage metadata", () => {
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{
            missing_entries?: {
                method?: string;
                route?: string;
                route_name?: string;
            }[];
        }>(path.join("packages", "missing-routes", "missing.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: unknown;
                    post?: {
                        responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
                        security?: unknown;
                        summary?: string;
                    };
                }
            >;
        }>(path.join("assets", "openapi.json"));
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
        }>(path.join("assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === assignedSourcePath);
        assert.deepEqual(sourceEntry, {
            method: "POST",
            response_schema_refs: ["APIErrorResponse"],
            route: assignedSourcePath,
            route_name: assignedRouteName,
            source: "src/api/routes/billing/popup-bridge/#payment_source_type.ts",
        });
        assert.equal(
            sourceCatalog.some((entry) => entry.route === assignedSourcePath && entry.method !== "POST"),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedMissingPath && entry.route_name === assignedRouteName),
            false,
        );

        const operation = openapi.paths?.["/billing/popup-bridge/{payment_source_type}/"]?.post;
        assert.equal(operation?.summary, "Create Billing Popup Bridge");
        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"], undefined);
        assert.equal(operation?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapi.paths?.["/billing/popup-bridge/{payment_source_type}/"]?.get, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, "/billing/popup-bridge/:payment_source_type/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/billing/popup-bridge/#payment_source_type.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [400, 401, 501]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [400, 401, 501]);
    });
});

function createRouteApp(options: { authentication?: boolean } = {}) {
    const app = express();

    if (options.authentication) app.use(Authentication);
    else {
        app.use((req, _res, next) => {
            req.user_id = "100000000000000001";
            next();
        });
    }
    app.use("/billing/popup-bridge/:payment_source_type", billingPopupBridgeRouter);
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "POST",
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
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

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as T;
}
