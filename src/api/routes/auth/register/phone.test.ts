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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../../middlewares";
import express from "express";
import { requestJson } from "../../../tests/helpers/UserRouteTestHelpers";

const requireModule = require;
const routeModulePath = require.resolve("./phone");
const manifestId = "api:http:POST:/auth/register/phone/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /auth/register/phone", () => {
    test("declares unauthenticated phone registration metadata and fail-closed provider behavior", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Register Account with Phone Number",
            description:
                "Sends a registration phone verification code when a real SMS provider is configured. The default Spacebar instance has no phone verification token store or SMS provider, so it fails closed with 501 instead of pretending a code was sent.",
            requestBody: "RegisterPhoneSchema",
            coerceRequestBody: false,
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("is public and fails closed when no SMS provider is configured", async () => {
        const routeModule = loadRouteModule();
        const unsupportedError = routeModule.createRegisterPhoneUnsupportedError();
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/auth/register/phone", routeModule.default);
        app.use(ErrorHandler);

        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/auth/register/phone"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/auth/register/phone/"), true);
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, routeModule.REGISTER_PHONE_UNSUPPORTED_MESSAGE);

        const response = await requestJson(app, "/auth/register/phone", { method: "POST", body: { phone: "+15555550123" } });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: routeModule.REGISTER_PHONE_UNSUPPORTED_MESSAGE,
        });
    });

    test("requires an E.164 phone number before provider dispatch", async () => {
        const calls: string[] = [];
        const app = express();
        app.use(express.json());
        app.use(
            "/auth/register/phone",
            loadRouteModule().createRegisterPhoneRouter({
                async sendRegistrationPhoneVerificationCode(phone) {
                    calls.push(phone);
                },
            }),
        );
        app.use(ErrorHandler);

        const response = await requestJson(app, "/auth/register/phone", { method: "POST", body: { phone: "555-0100" } });

        const responseBody = response.body as { code?: number; errors?: { phone?: unknown } };
        assert.equal(response.status, 400);
        assert.equal(responseBody.code, 50035);
        assert.ok(responseBody.errors?.phone);
        assert.deepEqual(calls, []);
    });

    test("returns 204 when an instance wires a real registration phone sender", async () => {
        const calls: { phone: string; fingerprint?: string; userAgent?: string }[] = [];
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.fingerprint = "test-fingerprint";
            next();
        });
        app.use(
            "/auth/register/phone",
            loadRouteModule().createRegisterPhoneRouter({
                async sendRegistrationPhoneVerificationCode(phone, context) {
                    calls.push({ phone, fingerprint: context.fingerprint, userAgent: context.userAgent });
                },
            }),
        );
        app.use(ErrorHandler);

        const response = await requestText(app, "/auth/register/phone", {
            method: "POST",
            body: { phone: "+15555550123" },
            headers: { "user-agent": "register-phone-test" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(calls, [{ phone: "+15555550123", fingerprint: "test-fingerprint", userAgent: "register-phone-test" }]);
    });

    test("generated artifacts own only the assigned POST register-phone route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "auth", "register", "phone.ts"), "utf8");
        const schemas = readJson<Record<string, { type?: string; required?: string[]; properties?: Record<string, { type?: string; pattern?: string }> }>>(
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
        assert.match(routeSource, /requestBody:\s*"RegisterPhoneSchema"/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|patch|put|delete)\(/);

        assert.equal(schemas.RegisterPhoneSchema?.type, "object");
        assert.deepEqual(schemas.RegisterPhoneSchema?.required, ["phone"]);
        assert.equal(schemas.RegisterPhoneSchema?.properties?.phone?.type, "string");
        assert.equal(schemas.RegisterPhoneSchema?.properties?.phone?.pattern, "^\\+[1-9]\\d{1,14}$");

        const openapiRoute = openapi.paths?.["/auth/register/phone/"]?.post;
        assert.equal(openapiRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/RegisterPhoneSchema");
        assert.ok(openapiRoute?.responses?.["204"]);
        assert.equal(openapiRoute?.responses?.["204"]?.content, undefined);
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.security, undefined);
        assert.equal(openapi.paths?.["/auth/register/phone/"]?.get, undefined);
        assert.equal(openapi.paths?.["/auth/register/phone/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/auth/register/phone/"]?.delete, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/auth/register/phone");
        assert.equal(sourceRoute?.route_name, "POST_AUTH_REGISTER_PHONE");
        assert.equal(sourceRoute?.source, "src/api/routes/auth/register/phone.ts");
        assert.equal(sourceRoute?.request_schema_ref, "RegisterPhoneSchema");
        assert.deepEqual(sourceRoute?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/auth/register/phone"),
            false,
        );
        assert.equal(missingRoutes.routes?.includes("/auth/register/phone"), false);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/auth/register/phone.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "RegisterPhoneSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [204, 400, 501]);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === manifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/auth/register/phone.ts");
        assert.equal(contractEntry?.routeMetadata?.requestBody, "RegisterPhoneSchema");
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [204, 400, 501]);
    });
});

function loadRouteModule(): typeof import("./phone") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./phone");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: unknown, _res: unknown, next: () => void) => next();
    });

    loadRouteModule();

    return routeOptions;
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
