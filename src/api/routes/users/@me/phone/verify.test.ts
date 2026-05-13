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
import { ErrorHandler, isNoAuthorizationRoute } from "../../../../middlewares";
import express from "express";
import { requestJson } from "../../../../tests/helpers/UserRouteTestHelpers";

const requireModule = require;
const routeModulePath = require.resolve("./verify");
const manifestId = "api:http:POST:/users/@me/phone/verify/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /users/@me/phone/verify", () => {
    test("declares authenticated phone-code verification metadata and fail-closed provider behavior", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Verify Current User Phone Number Without Password",
            description:
                "Verifies a phone SMS code and returns a phone token when a real phone verification token store and SMS provider are configured. The default Spacebar instance has neither, so it fails closed with 501 instead of accepting or minting phone tokens locally.",
            requestBody: "UserPhoneVerifyNoPasswordSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "UserPhoneVerifyNoPasswordResponse",
                },
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

    test("is authenticated and fails closed when no phone-code verifier is configured", async () => {
        const routeModule = loadRouteModule();
        const unsupportedError = routeModule.createUserPhoneVerifyNoPasswordUnsupportedError();
        const app = createRouteApp(routeModule.default);

        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/phone/verify"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/users/@me/phone/verify/"), false);
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, routeModule.USER_PHONE_VERIFY_NO_PASSWORD_UNSUPPORTED_MESSAGE);

        const response = await requestJson(app, "/users/@me/phone/verify", {
            method: "POST",
            body: { phone: "+15555550123", code: "123456" },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: routeModule.USER_PHONE_VERIFY_NO_PASSWORD_UNSUPPORTED_MESSAGE,
        });
    });

    test("validates the phone number and code before provider dispatch", async () => {
        const calls: unknown[] = [];
        const app = createRouteApp(
            loadRouteModule().createUserPhoneVerifyNoPasswordRouter({
                async verifyCurrentUserPhoneCode(userId, phone, code) {
                    calls.push({ userId, phone, code });
                    return { phone_token: "phone-token" };
                },
            }),
        );

        const response = await requestJson(app, "/users/@me/phone/verify", {
            method: "POST",
            body: { phone: "555-0100", code: "" },
        });

        const responseBody = response.body as { code?: number; errors?: { phone?: unknown; code?: unknown } };
        assert.equal(response.status, 400);
        assert.equal(responseBody.code, 50035);
        assert.ok(responseBody.errors?.phone);
        assert.ok(responseBody.errors?.code);
        assert.deepEqual(calls, []);
    });

    test("returns a phone token when an instance wires a real phone-code verifier", async () => {
        const calls: { userId: string; phone: string; code: string; fingerprint?: string; userAgent?: string }[] = [];
        const app = createRouteApp(
            loadRouteModule().createUserPhoneVerifyNoPasswordRouter({
                async verifyCurrentUserPhoneCode(userId, phone, code, context) {
                    calls.push({ userId, phone, code, fingerprint: context.fingerprint, userAgent: context.userAgent });
                    return { phone_token: "phone-token" };
                },
            }),
        );

        const response = await requestJsonWithHeaders(app, "/users/@me/phone/verify", {
            method: "POST",
            body: { phone: "+15555550123", code: "123456" },
            headers: { "user-agent": "phone-verify-no-password-test" },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { phone_token: "phone-token" });
        assert.deepEqual(calls, [
            {
                userId: "user-id",
                phone: "+15555550123",
                code: "123456",
                fingerprint: "test-fingerprint",
                userAgent: "phone-verify-no-password-test",
            },
        ]);
    });

    test("generated artifacts own only the assigned POST phone verify route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "phone", "verify.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    required?: string[];
                    properties?: Record<string, { type?: string; pattern?: string; minLength?: number; maxLength?: number }>;
                }
            >
        >(path.join("assets", "schemas.json"));
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
        assert.match(routeSource, /requestBody:\s*"UserPhoneVerifyNoPasswordSchema"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"UserPhoneVerifyNoPasswordResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|patch|put|delete)\(/);

        assert.equal(schemas.UserPhoneVerifyNoPasswordSchema?.type, "object");
        assert.deepEqual(schemas.UserPhoneVerifyNoPasswordSchema?.required, ["code", "phone"]);
        assert.equal(schemas.UserPhoneVerifyNoPasswordSchema?.properties?.phone?.type, "string");
        assert.equal(schemas.UserPhoneVerifyNoPasswordSchema?.properties?.phone?.pattern, "^\\+[1-9]\\d{1,14}$");
        assert.equal(schemas.UserPhoneVerifyNoPasswordSchema?.properties?.code?.type, "string");
        assert.equal(schemas.UserPhoneVerifyNoPasswordSchema?.properties?.code?.minLength, 1);
        assert.equal(schemas.UserPhoneVerifyNoPasswordSchema?.properties?.code?.maxLength, 64);
        assert.deepEqual(schemas.UserPhoneVerifyNoPasswordResponse?.required, ["phone_token"]);
        assert.equal(schemas.UserPhoneVerifyNoPasswordResponse?.properties?.phone_token?.type, "string");
        assert.equal(schemas.UserPhoneVerifyNoPasswordResponse?.properties?.phone_token?.minLength, 1);

        const openapiRoute = openapi.paths?.["/users/@me/phone/verify/"]?.post;
        assert.equal(openapiRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserPhoneVerifyNoPasswordSchema");
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserPhoneVerifyNoPasswordResponse");
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/users/@me/phone/verify/"]?.get, undefined);
        assert.equal(openapi.paths?.["/users/@me/phone/verify/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/users/@me/phone/verify/"]?.delete, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/users/@me/phone/verify");
        assert.equal(sourceRoute?.route_name, "POST_USERS__ME_PHONE_VERIFY");
        assert.equal(sourceRoute?.source, "src/api/routes/users/@me/phone/verify.ts");
        assert.equal(sourceRoute?.request_schema_ref, "UserPhoneVerifyNoPasswordSchema");
        assert.deepEqual(sourceRoute?.response_schema_refs, ["APIErrorResponse", "UserPhoneVerifyNoPasswordResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/phone/verify" && entry.route_name === "PHONE_VERIFY_NO_PASSWORD"),
            false,
        );
        assert.equal(missingRoutes.routes?.includes("/users/@me/phone/verify"), false);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/phone"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/users/@me/phone/reverify"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/phone/verify.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "UserPhoneVerifyNoPasswordSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "UserPhoneVerifyNoPasswordResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 501]);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === manifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/users/@me/phone/verify.ts");
        assert.equal(contractEntry?.routeMetadata?.requestBody, "UserPhoneVerifyNoPasswordSchema");
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse", "UserPhoneVerifyNoPasswordResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 501]);
    });
});

function loadRouteModule(): typeof import("./verify") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./verify");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
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
    app.use("/users/@me/phone/verify", router);
    app.use(ErrorHandler);
    return app;
}

async function requestJsonWithHeaders(app: express.Express, routePath: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
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
            body: await response.json(),
        };
    } finally {
        server.close();
    }
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}
