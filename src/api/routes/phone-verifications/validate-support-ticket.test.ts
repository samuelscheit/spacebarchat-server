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
import { ErrorHandler, isNoAuthorizationRoute } from "../../middlewares";
import express from "express";
import { requestJson } from "../../tests/helpers/UserRouteTestHelpers";

const requireModule = require;
const routeModulePath = require.resolve("./validate-support-ticket");
const manifestId = "api:http:POST:/phone-verifications/validate-support-ticket/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /phone-verifications/validate-support-ticket", () => {
    test("declares authenticated support-ticket validation metadata and fail-closed provider behavior", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Validate Phone Verification Support Ticket",
            description:
                "Validates a phone-verification support-ticket token when a real phone verification token store and support-ticket backend are configured. The default Spacebar instance has neither, so it fails closed with 501 instead of accepting opaque support-ticket tokens.",
            requestBody: "PhoneVerificationSupportTicketValidateSchema",
            coerceRequestBody: false,
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

    test("is authenticated and fails closed when no token validator is configured", async () => {
        const routeModule = loadRouteModule();
        const unsupportedError = routeModule.createPhoneSupportTicketValidationUnsupportedError();
        const app = createRouteApp(routeModule.default);

        assert.equal(isNoAuthorizationRoute("POST", "/phone-verifications/validate-support-ticket"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/phone-verifications/validate-support-ticket/"), false);
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, routeModule.PHONE_SUPPORT_TICKET_VALIDATION_UNSUPPORTED_MESSAGE);

        const response = await requestJson(app, "/phone-verifications/validate-support-ticket", { method: "POST", body: { token: "support-ticket-token" } });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: routeModule.PHONE_SUPPORT_TICKET_VALIDATION_UNSUPPORTED_MESSAGE,
        });
    });

    test("validates the support-ticket token before provider dispatch", async () => {
        const calls: unknown[] = [];
        const app = createRouteApp(
            loadRouteModule().createPhoneSupportTicketValidationRouter({
                async validatePhoneSupportTicket(userId, token) {
                    calls.push({ userId, token });
                },
            }),
        );

        const response = await requestJson(app, "/phone-verifications/validate-support-ticket", { method: "POST", body: { token: "" } });

        const responseBody = response.body as { code?: number; errors?: { token?: unknown } };
        assert.equal(response.status, 400);
        assert.equal(responseBody.code, 50035);
        assert.ok(responseBody.errors?.token);
        assert.deepEqual(calls, []);
    });

    test("returns 204 when an instance wires a real support-ticket token validator", async () => {
        const calls: { userId: string; token: string; fingerprint?: string; userAgent?: string }[] = [];
        const app = createRouteApp(
            loadRouteModule().createPhoneSupportTicketValidationRouter({
                async validatePhoneSupportTicket(userId, token, context) {
                    calls.push({ userId, token, fingerprint: context.fingerprint, userAgent: context.userAgent });
                },
            }),
        );

        const response = await requestText(app, "/phone-verifications/validate-support-ticket", {
            method: "POST",
            body: { token: "support-ticket-token" },
            headers: { "user-agent": "phone-support-ticket-test" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(calls, [
            {
                userId: "user-id",
                token: "support-ticket-token",
                fingerprint: "test-fingerprint",
                userAgent: "phone-support-ticket-test",
            },
        ]);
    });

    test("generated artifacts own only the assigned POST support-ticket route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "phone-verifications", "validate-support-ticket.ts"), "utf8");
        const schemas = readJson<Record<string, { type?: string; required?: string[]; properties?: Record<string, { type?: string; minLength?: number; maxLength?: number }> }>>(
            path.join("assets", "schemas.json"),
        );
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    post?: {
                        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    get?: unknown;
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
                request_schema_ref?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ routes?: string[]; missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            path.join("packages", "missing-routes", "missing.json"),
        );
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{
            contracts?: {
                manifestId?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /router\.post\(\s*["']\/["']/);
        assert.match(routeSource, /requestBody:\s*"PhoneVerificationSupportTicketValidateSchema"/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|patch|put|delete)\(/);

        assert.equal(schemas.PhoneVerificationSupportTicketValidateSchema?.type, "object");
        assert.deepEqual(schemas.PhoneVerificationSupportTicketValidateSchema?.required, ["token"]);
        assert.equal(schemas.PhoneVerificationSupportTicketValidateSchema?.properties?.token?.type, "string");
        assert.equal(schemas.PhoneVerificationSupportTicketValidateSchema?.properties?.token?.minLength, 1);
        assert.equal(schemas.PhoneVerificationSupportTicketValidateSchema?.properties?.token?.maxLength, 4096);

        const openapiRoute = openapi.paths?.["/phone-verifications/validate-support-ticket/"]?.post;
        assert.equal(openapiRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/PhoneVerificationSupportTicketValidateSchema");
        assert.ok(openapiRoute?.responses?.["204"]);
        assert.equal(openapiRoute?.responses?.["204"]?.content, undefined);
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/phone-verifications/validate-support-ticket/"]?.get, undefined);
        assert.equal(openapi.paths?.["/phone-verifications/validate-support-ticket/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/phone-verifications/validate-support-ticket/"]?.delete, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/phone-verifications/validate-support-ticket");
        assert.equal(sourceRoute?.route_name, "POST_PHONE_VERIFICATIONS_VALIDATE_SUPPORT_TICKET");
        assert.equal(sourceRoute?.source, "src/api/routes/phone-verifications/validate-support-ticket.ts");
        assert.equal(sourceRoute?.request_schema_ref, "PhoneVerificationSupportTicketValidateSchema");
        assert.deepEqual(sourceRoute?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "POST" && entry.route === "/phone-verifications/validate-support-ticket" && entry.route_name === "VERIFY_PHONE_FOR_TICKET",
            ),
            false,
        );
        assert.equal(missingRoutes.routes?.includes("/phone-verifications/validate-support-ticket"), false);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/phone-verifications/resend"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/phone-verifications/verify"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/phone-verifications/validate-support-ticket.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "PhoneVerificationSupportTicketValidateSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 400, 401, 501]);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === manifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/phone-verifications/validate-support-ticket.ts");
        assert.equal(contractEntry?.routeMetadata?.requestBody, "PhoneVerificationSupportTicketValidateSchema");
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [204, 400, 401, 501]);
    });
});

function loadRouteModule(): typeof import("./validate-support-ticket") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./validate-support-ticket");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: unknown, _res: unknown, next: () => void) => next();
    });

    loadRouteModule();

    return routeOptions;
}

function createRouteApp(router: express.Router): express.Express {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "user-id";
        req.fingerprint = "test-fingerprint";
        next();
    });
    app.use("/phone-verifications/validate-support-ticket", router);
    app.use(ErrorHandler);
    return app;
}

async function requestText(app: express.Express, routePath: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const headers = {
            ...(options.body == undefined ? {} : { "content-type": "application/json" }),
            ...options.headers,
        };
        const response = await fetch(`http://127.0.0.1:${address.port}${routePath}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers,
        });

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}
