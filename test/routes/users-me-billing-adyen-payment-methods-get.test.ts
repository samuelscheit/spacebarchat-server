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
import adyenPaymentMethodsRouter, {
    ADYEN_PAYMENT_METHODS_UNSUPPORTED_MESSAGE,
    createAdyenPaymentMethodsUnsupportedError,
} from "../../src/api/routes/users/@me/billing/adyen/payment-methods";

const manifestId = "api:http:GET:/users/@me/billing/adyen/payment-methods/";

describe("GET /users/@me/billing/adyen/payment-methods", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(manifestId, "api:http:GET:/users/@me/billing/adyen/payment-methods/");
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(Authentication);
        app.use("/users/@me/billing/adyen/payment-methods", adyenPaymentMethodsRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/users/@me/billing/adyen/payment-methods");

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.equal(response.body.message, "Error: Missing Authorization Header");
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/billing/adyen/payment-methods"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/billing/adyen/payment-methods"), false);
    });

    test("fails closed instead of fabricating Adyen provider availability", async () => {
        const app = setupAuthenticatedRoute();

        const response = await requestJson(app, "/users/@me/billing/adyen/payment-methods");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: ADYEN_PAYMENT_METHODS_UNSUPPORTED_MESSAGE,
        });
        assert.deepEqual(
            {
                code: createAdyenPaymentMethodsUnsupportedError().code,
                httpStatus: createAdyenPaymentMethodsUnsupportedError().httpStatus,
                message: createAdyenPaymentMethodsUnsupportedError().message,
            },
            {
                code: 0,
                httpStatus: 501,
                message: ADYEN_PAYMENT_METHODS_UNSUPPORTED_MESSAGE,
            },
        );
    });

    test("documents fail-closed route metadata without adjacent billing behavior", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "billing", "adyen", "payment-methods.ts"), "utf-8");

        assert.match(routeSource, /summary:\s*"Get Available Adyen Payment Methods"/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /fails closed instead of fabricating provider availability/);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.doesNotMatch(routeSource, /router\.(?:post|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /PaymentSource|Subscription|Stripe|payment-intents|entitlement|premium/i);
    });

    test("generated artifacts own only the assigned GET route", () => {
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        security?: unknown;
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
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

        const route = openapi.paths?.["/users/@me/billing/adyen/payment-methods/"];
        assert.equal(route?.get?.responses?.["200"], undefined);
        assert.equal(route?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.get?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.get?.security, [{ bearer: [] }]);
        assert.equal(route?.post, undefined);
        assert.equal(route?.put, undefined);
        assert.equal(route?.patch, undefined);
        assert.equal(route?.delete, undefined);

        const getSourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/billing/adyen/payment-methods");
        assert.deepEqual(getSourceRoute, {
            method: "GET",
            response_schema_refs: ["APIErrorResponse"],
            route: "/users/@me/billing/adyen/payment-methods",
            route_name: "GET_USERS__ME_BILLING_ADYEN_PAYMENT_METHODS",
            source: "src/api/routes/users/@me/billing/adyen/payment-methods.ts",
        });

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/billing/adyen/payment-methods"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/billing/adyen/payment-methods.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [401, 501]);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === manifestId),
            true,
        );
        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(manifestId), true);
    });
});

function setupAuthenticatedRoute() {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/billing/adyen/payment-methods", adyenPaymentMethodsRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

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
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf-8")) as T;
}
