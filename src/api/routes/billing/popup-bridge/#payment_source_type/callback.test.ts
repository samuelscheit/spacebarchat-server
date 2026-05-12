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
import { afterEach, describe, test, type TestContext } from "node:test";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";

const requireModule = require;
const routeModulePath = require.resolve("./callback");
const manifestId = "api:http:POST:/billing/popup-bridge/:payment_source_type/callback/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /billing/popup-bridge/:payment_source_type/callback", () => {
    test("declares authenticated fail-closed billing popup callback metadata", (t) => {
        const harness = setupBillingPopupBridgeCallbackRouteWithMockedMetadata(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Create Billing Popup Bridge Callback",
            description:
                "Completes a third-party billing popup flow after the authenticated client receives the provider redirect. Spacebar does not currently persist popup bridge state or provider callback verification data, so the default implementation fails closed instead of accepting unverifiable payment callbacks.",
            requestBody: "BillingPopupBridgeCallbackSchema",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays behind bearer authentication", async () => {
        const authModule = requireModule(distModulePath("api", "middlewares", "Authentication.js")) as typeof import("../../../../middlewares/Authentication");
        const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../../middlewares/ErrorHandler");
        const routeModule = requireModule(routeModulePath) as typeof import("./callback");

        const app = express();
        app.use(express.json());
        app.use(authModule.Authentication);
        app.use("/billing/popup-bridge/:payment_source_type/callback", routeModule.default);
        app.use(errorHandlerModule.ErrorHandler);

        const response = await requestJson(app, "/billing/popup-bridge/paypal/callback", {
            method: "POST",
            body: {
                state: "bridge-state",
                path: "/billing/popup-bridge/paypal/callback/bridge-state/return",
            },
        });

        assert.equal(response.status, 401);
        assert.deepEqual(response.body, {
            code: 401,
            message: "Error: Missing Authorization Header",
        });
        assert.equal(authModule.isNoAuthorizationRoute("POST", "/billing/popup-bridge/paypal/callback"), false);
        assert.equal(authModule.isNoAuthorizationRoute("POST", "/api/v9/billing/popup-bridge/paypal/callback"), false);
    });

    test("fails closed for valid callbacks until popup bridge state and provider verification exist", async () => {
        const routeModule = requireModule(routeModulePath) as typeof import("./callback");
        const app = setupAuthenticatedRoute(routeModule.createBillingPopupBridgeCallbackRouter());

        const response = await requestJson(app, "/billing/popup-bridge/paypal/callback", {
            method: "POST",
            body: {
                state: "bridge-state",
                path: "/billing/popup-bridge/paypal/callback/bridge-state/return",
                query: {
                    token: "provider-token",
                    ba_token: "billing-agreement-token",
                },
                insecure: false,
            },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: routeModule.createBillingPopupBridgeCallbackUnsupportedError().code,
            message: routeModule.BILLING_POPUP_BRIDGE_CALLBACK_UNSUPPORTED_MESSAGE,
        });
    });

    test("normalizes callback payloads for an injected local bridge handler", async () => {
        const routeModule = requireModule(routeModulePath) as typeof import("./callback");
        const callbacks: import("./callback").BillingPopupBridgeCallback[] = [];
        const app = setupAuthenticatedRoute(
            routeModule.createBillingPopupBridgeCallbackRouter((callback) => {
                callbacks.push(callback);
            }),
        );

        const response = await requestJson(app, "/billing/popup-bridge/15/callback", {
            method: "POST",
            body: {
                state: "bridge-state",
                path: "/billing/popup-bridge/15/callback/bridge-state/return",
                query: {
                    redirect_status: "succeeded",
                },
            },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.deepEqual(callbacks, [
            {
                paymentSourceType: "15",
                userId: "viewer",
                state: "bridge-state",
                path: "/billing/popup-bridge/15/callback/bridge-state/return",
                query: {
                    redirect_status: "succeeded",
                },
                insecure: false,
            },
        ]);
    });

    test("rejects malformed callback bodies before local bridge handling", async () => {
        const routeModule = requireModule(routeModulePath) as typeof import("./callback");
        const callbacks: unknown[] = [];
        const app = setupAuthenticatedRoute(
            routeModule.createBillingPopupBridgeCallbackRouter((callback) => {
                callbacks.push(callback);
            }),
        );

        const missingState = await requestJson(app, "/billing/popup-bridge/paypal/callback", {
            method: "POST",
            body: {
                path: "/billing/popup-bridge/paypal/callback/bridge-state/return",
            },
        });
        const nonStringQueryValue = await requestJson(app, "/billing/popup-bridge/paypal/callback", {
            method: "POST",
            body: {
                state: "bridge-state",
                path: "/billing/popup-bridge/paypal/callback/bridge-state/return",
                query: {
                    token: {
                        nested: true,
                    },
                },
            },
        });
        const unexpectedField = await requestJson(app, "/billing/popup-bridge/paypal/callback", {
            method: "POST",
            body: {
                state: "bridge-state",
                path: "/billing/popup-bridge/paypal/callback/bridge-state/return",
                extra: true,
            },
        });

        assert.equal(missingState.status, 400);
        assert.equal((missingState.body as { code?: number }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
        assert.equal(nonStringQueryValue.status, 400);
        assert.equal((nonStringQueryValue.body as { code?: number }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
        assert.equal(unexpectedField.status, 400);
        assert.equal((unexpectedField.body as { code?: number }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
        assert.deepEqual(callbacks, []);
    });

    test("generated artifacts own only the assigned POST callback route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "billing", "popup-bridge", "#payment_source_type", "callback.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    additionalProperties?: { type?: string } | boolean;
                    properties?: Record<string, { type?: string; $ref?: string }>;
                    required?: string[];
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: unknown;
                    post?: {
                        security?: unknown;
                        requestBody?: { required?: boolean; content?: Record<string, { schema?: { $ref?: string } }> };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                    };
                    put?: unknown;
                    patch?: unknown;
                    delete?: unknown;
                }
            >;
            components?: { schemas?: Record<string, unknown> };
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                request_schema_ref?: string;
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
                    requestBody?: string;
                    event?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string }[] }>(path.join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /router\.post\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(?:get|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /callback\/:|callback\/\{/);
        assert.doesNotMatch(routeSource, /router\.post\(\s*["']\/[^"']+/);

        assert.equal(schemas.BillingPopupBridgeCallbackSchema?.type, "object");
        assert.equal(schemas.BillingPopupBridgeCallbackSchema?.properties?.state?.type, "string");
        assert.equal(schemas.BillingPopupBridgeCallbackSchema?.properties?.path?.type, "string");
        assert.deepEqual(schemas.BillingPopupBridgeCallbackSchema?.properties?.query, {
            $ref: "#/definitions/BillingPopupBridgeCallbackQuery",
        });
        assert.equal(schemas.BillingPopupBridgeCallbackSchema?.properties?.insecure?.type, "boolean");
        assert.deepEqual(schemas.BillingPopupBridgeCallbackSchema?.required?.sort(), ["path", "state"]);
        assert.deepEqual(schemas.BillingPopupBridgeCallbackQuery?.additionalProperties, {
            type: "string",
        });

        const route = openapi.paths?.["/billing/popup-bridge/{payment_source_type}/callback/"];
        assert.equal(route?.post?.requestBody?.required, true);
        assert.equal(route?.post?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/BillingPopupBridgeCallbackSchema");
        assert.equal(route?.post?.responses?.["204"]?.content, undefined);
        assert.equal(route?.post?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.post?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.post?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.post?.security, [{ bearer: [] }]);
        assert.equal(route?.get, undefined);
        assert.equal(route?.put, undefined);
        assert.equal(route?.patch, undefined);
        assert.equal(route?.delete, undefined);

        const postSourceRoute = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/billing/popup-bridge/{payment_source_type}/callback");
        assert.deepEqual(postSourceRoute, {
            method: "POST",
            request_schema_ref: "BillingPopupBridgeCallbackSchema",
            response_schema_refs: ["APIErrorResponse"],
            route: "/billing/popup-bridge/{payment_source_type}/callback",
            route_name: "POST_BILLING_POPUP_BRIDGE_PAYMENT_SOURCE_TYPE_CALLBACK",
            source: "src/api/routes/billing/popup-bridge/#payment_source_type/callback.ts",
        });

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/billing/popup-bridge/{param}/callback"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/billing/popup-bridge/#payment_source_type/callback.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "BillingPopupBridgeCallbackSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 400, 401, 501]);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === manifestId),
            true,
        );
    });
});

type TestHarness = {
    app: express.Express;
    routeOptions: unknown[];
};

function setupBillingPopupBridgeCallbackRouteWithMockedMetadata(t: TestContext): TestHarness {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./callback");
    const app = setupAuthenticatedRoute(routeModule.createBillingPopupBridgeCallbackRouter());

    return {
        app,
        routeOptions,
    };
}

function setupAuthenticatedRoute(router: express.Router): express.Express {
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../../middlewares/ErrorHandler");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/billing/popup-bridge/:payment_source_type/callback", router);
    app.use(errorHandlerModule.ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string, init: { method: string; body?: unknown }): Promise<{ status: number; body: unknown | undefined }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: init.method,
            headers: init.body === undefined ? undefined : { "content-type": "application/json" },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
        const text = await response.text();

        return {
            status: response.status,
            body: text ? (JSON.parse(text) as unknown) : undefined,
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

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8")) as T;
}
