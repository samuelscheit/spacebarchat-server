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
import type { PaymentInvoiceBreakdownResponse } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import { ErrorHandler } from "../../../../../middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../../../../middlewares/NoAuthorizationRoutes";

const requireModule = require;
const routeModulePath = require.resolve("./breakdown");
const manifestId = "api:http:GET:/users/@me/billing/invoice/breakdown/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/@me/billing/invoice/breakdown", () => {
    test("declares authenticated invoice breakdown metadata", (t) => {
        const harness = setupUserBillingInvoiceBreakdownRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Payment Invoice Breakdown",
            description:
                "Returns invoice download URLs for a current-user payment when locally persisted billing-provider invoice state exists. Spacebar does not currently persist Discord billing payments or provider invoice URLs, so unknown payments fail closed instead of fabricating invoice links.",
            query: {
                payment_id: {
                    type: "string",
                    required: true,
                    description: "Payment ID to retrieve invoice download URLs for.",
                },
            },
            responses: {
                200: {
                    body: "PaymentInvoiceBreakdownResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays on the authenticated current-user route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/billing/invoice/breakdown"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/billing/invoice/breakdown"), false);
    });

    test("parses only Discord snowflake payment IDs from the required query", () => {
        const routeModule = requireModule(routeModulePath) as typeof import("./breakdown");

        assert.equal(routeModule.isPaymentInvoiceBreakdownPaymentId("100000000000000001"), true);
        assert.equal(routeModule.isPaymentInvoiceBreakdownPaymentId("99999999999999999999"), true);
        assert.equal(routeModule.isPaymentInvoiceBreakdownPaymentId(""), false);
        assert.equal(routeModule.isPaymentInvoiceBreakdownPaymentId("123"), false);
        assert.equal(routeModule.isPaymentInvoiceBreakdownPaymentId("0100000000000000001"), false);
        assert.equal(routeModule.isPaymentInvoiceBreakdownPaymentId("not-a-payment"), false);
        assert.equal(routeModule.isPaymentInvoiceBreakdownPaymentId("100000000000000001000"), false);
        assert.equal(routeModule.parsePaymentInvoiceBreakdownQuery({ payment_id: ["100000000000000001", "100000000000000002"] }), "100000000000000001");
        assert.throws(() => routeModule.parsePaymentInvoiceBreakdownQuery({}), DiscordApiErrors.INVALID_FORM_BODY);
    });

    test("fails closed for valid payment IDs until local billing payment invoices are persisted", async (t) => {
        const routeModule = requireModule(routeModulePath) as typeof import("./breakdown");
        assert.equal(await routeModule.getPaymentInvoiceBreakdown("100000000000000001", "viewer"), null);

        const response = await requestJson(setupUserBillingInvoiceBreakdownRoute(t).app, "/users/@me/billing/invoice/breakdown?payment_id=100000000000000001");

        assert.deepEqual(response, {
            status: 404,
            body: {
                code: routeModule.UNKNOWN_BILLING_PAYMENT.code,
                message: routeModule.UNKNOWN_BILLING_PAYMENT.message,
            },
        });
    });

    test("rejects missing or malformed payment IDs as invalid form body", async (t) => {
        const harness = setupUserBillingInvoiceBreakdownRoute(t);

        const missingPaymentId = await requestJson(harness.app, "/users/@me/billing/invoice/breakdown");
        const invalidPaymentId = await requestJson(harness.app, "/users/@me/billing/invoice/breakdown?payment_id=not-a-payment");

        assert.equal(missingPaymentId.status, 400);
        assert.equal((missingPaymentId.body as { code?: number }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
        assert.equal(invalidPaymentId.status, 400);
        assert.equal((invalidPaymentId.body as { code?: number }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
    });

    test("returns invoice links when a local provider can resolve the payment", async (t) => {
        const body: PaymentInvoiceBreakdownResponse = {
            invoiceLink: "https://billing.example.test/invoices/100000000000000001.pdf",
            refundInvoiceLinks: ["https://billing.example.test/refunds/100000000000000001-1.pdf"],
        };
        const calls: unknown[][] = [];
        const harness = setupUserBillingInvoiceBreakdownRoute(t, (paymentId, userId) => {
            calls.push([paymentId, userId]);
            return body;
        });

        const response = await requestJson(harness.app, "/users/@me/billing/invoice/breakdown?payment_id=100000000000000001");

        assert.deepEqual(calls, [["100000000000000001", "viewer"]]);
        assert.deepEqual(response, {
            status: 200,
            body,
        });
    });

    test("generated artifacts own only the assigned GET invoice breakdown route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "billing", "invoice", "breakdown.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    properties?: Record<string, { type?: string; items?: { type?: string } }>;
                    required?: string[];
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; required?: boolean; schema?: { type?: string } }[];
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
                    hasQuery?: boolean;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string }[] }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[] }[] }[] }>(path.join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(?:post|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /payment-sources|subscriptions|checkout|stripe|entitlement|nitro|purchase/i);

        assert.equal(schemas.PaymentInvoiceBreakdownResponse?.type, "object");
        assert.equal(schemas.PaymentInvoiceBreakdownResponse?.properties?.invoiceLink?.type, "string");
        assert.equal(schemas.PaymentInvoiceBreakdownResponse?.properties?.refundInvoiceLinks?.type, "array");
        assert.equal(schemas.PaymentInvoiceBreakdownResponse?.properties?.refundInvoiceLinks?.items?.type, "string");
        assert.deepEqual(schemas.PaymentInvoiceBreakdownResponse?.required, undefined);

        const route = openapi.paths?.["/users/@me/billing/invoice/breakdown/"];
        assert.equal(route?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PaymentInvoiceBreakdownResponse");
        assert.equal(route?.get?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.get?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.get?.parameters?.find((parameter) => parameter.name === "payment_id")?.required, true);
        assert.equal(route?.get?.parameters?.find((parameter) => parameter.name === "payment_id")?.schema?.type, "string");
        assert.deepEqual(route?.get?.security, [{ bearer: [] }]);
        assert.equal(route?.post, undefined);
        assert.equal(route?.put, undefined);
        assert.equal(route?.patch, undefined);
        assert.equal(route?.delete, undefined);

        const getSourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/billing/invoice/breakdown");
        assert.equal(getSourceRoute?.route_name, "GET_USERS__ME_BILLING_INVOICE_BREAKDOWN");
        assert.equal(getSourceRoute?.source, "src/api/routes/users/@me/billing/invoice/breakdown.ts");
        assert.equal(getSourceRoute?.response_schema_refs?.includes("PaymentInvoiceBreakdownResponse"), true);
        assert.equal(getSourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/billing/invoice/breakdown"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/billing/invoice/breakdown.ts");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("PaymentInvoiceBreakdownResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);

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

function setupUserBillingInvoiceBreakdownRoute(t: TestContext, invoiceProvider?: import("./breakdown").PaymentInvoiceBreakdownProvider): TestHarness {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./breakdown");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/billing/invoice/breakdown", routeModule.createUserBillingInvoiceBreakdownRouter(invoiceProvider));
    app.use(ErrorHandler);

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

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8")) as T;
}
