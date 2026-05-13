process.env.LOG_ROUTES = "false";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../../../middlewares";
import express from "express";

const requireModule = require;
const routeModulePath = require.resolve("./#classification_id");
const manifestId = "api:http:PUT:/safety-hub/suspended/request-review/:classification_id/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("PUT /safety-hub/suspended/request-review/:classification_id", () => {
    test("declares public suspended classification review metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Request Classification Review for Suspended User",
            description:
                "Requests a Safety Hub classification review for a suspended user when a real suspended-user token verifier and durable appeal store are configured. The default Spacebar instance has no local Trust & Safety appeal provider, so this compatibility endpoint validates the request and fails closed with 501 instead of fabricating appeal state.",
            requestBody: "SafetyHubSuspendedClassificationReviewSchema",
            coerceRequestBody: false,
            responses: {
                200: {
                    body: "SafetyHubClassificationReviewResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
                501: {
                    body: "APIErrorResponse",
                },
            },
            spacebarOnly: false,
        });
    });

    test("is public and fails closed without an appeal provider", async () => {
        const routeModule = loadRouteModule();
        const unsupportedError = routeModule.createSafetyHubSuspendedClassificationReviewUnsupportedError();
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/safety-hub/suspended/request-review/:classification_id", routeModule.default);
        app.use(ErrorHandler);

        assert.equal(isNoAuthorizationRoute("PUT", "/api/v9/safety-hub/suspended/request-review/123456789012345678"), true);
        assert.equal(isNoAuthorizationRoute("PUT", "/api/v9/safety-hub/suspended/request-review/123456789012345678/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/safety-hub/suspended/request-review/123456789012345678"), false);
        assert.equal(unsupportedError.httpStatus, 501);
        assert.equal(unsupportedError.code, 0);
        assert.equal(unsupportedError.message, routeModule.SAFETY_HUB_SUSPENDED_CLASSIFICATION_REVIEW_UNSUPPORTED_MESSAGE);

        const response = await requestJson(app, "/safety-hub/suspended/request-review/123456789012345678", {
            method: "PUT",
            body: reviewBody(),
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: routeModule.SAFETY_HUB_SUSPENDED_CLASSIFICATION_REVIEW_UNSUPPORTED_MESSAGE,
        });
    });

    test("validates request body before provider dispatch", async () => {
        const calls: unknown[] = [];
        const app = express();
        app.use(express.json());
        app.use(
            "/safety-hub/suspended/request-review/:classification_id",
            loadRouteModule().createSafetyHubSuspendedClassificationReviewRouter({
                async requestReview(request) {
                    calls.push(request);
                    return { appeal_id: "223456789012345678" };
                },
            }),
        );
        app.use(ErrorHandler);

        const response = await requestJson(app, "/safety-hub/suspended/request-review/123456789012345678", {
            method: "PUT",
            body: reviewBody({ signal: "1" }),
        });

        const responseBody = response.body as { code?: number; errors?: { signal?: unknown } };
        assert.equal(response.status, 400);
        assert.equal(responseBody.code, 50035);
        assert.ok(responseBody.errors?.signal);
        assert.deepEqual(calls, []);
    });

    test("rejects invalid classification ids before provider dispatch", async () => {
        const calls: unknown[] = [];
        const app = express();
        app.use(express.json());
        app.use(
            "/safety-hub/suspended/request-review/:classification_id",
            loadRouteModule().createSafetyHubSuspendedClassificationReviewRouter({
                async requestReview(request) {
                    calls.push(request);
                    return { appeal_id: "223456789012345678" };
                },
            }),
        );
        app.use(ErrorHandler);

        const response = await requestJson(app, "/safety-hub/suspended/request-review/not-a-snowflake", {
            method: "PUT",
            body: reviewBody(),
        });

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: 0,
            message: "Unknown safety hub classification",
        });
        assert.deepEqual(calls, []);
    });

    test("returns provider appeal ids when an instance wires review persistence", async () => {
        const calls: unknown[] = [];
        const app = express();
        app.use(express.json());
        app.use(
            "/safety-hub/suspended/request-review/:classification_id",
            loadRouteModule().createSafetyHubSuspendedClassificationReviewRouter({
                async requestReview(request) {
                    calls.push(request);
                    return { appeal_id: "223456789012345678" };
                },
            }),
        );
        app.use(ErrorHandler);

        const response = await requestJson(app, "/safety-hub/suspended/request-review/123456789012345678", {
            method: "PUT",
            body: reviewBody({ user_input: "Please review this action." }),
            headers: { "user-agent": "safety-hub-review-test" },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { appeal_id: "223456789012345678" });
        assert.equal(calls.length, 1);
        assert.deepEqual(
            {
                ...(calls[0] as Record<string, unknown>),
                ip: "normalized-for-test",
            },
            {
                classification_id: "123456789012345678",
                token: "suspended-token",
                signal: 1,
                user_input: "Please review this action.",
                ip: "normalized-for-test",
                userAgent: "safety-hub-review-test",
            },
        );
        assert.equal(typeof (calls[0] as { ip?: unknown }).ip, "string");
    });

    test("generated artifacts own only the assigned PUT suspended review route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "safety-hub", "suspended", "request-review", "#classification_id.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    enum?: number[];
                    required?: string[];
                    properties?: Record<string, { type?: string; minLength?: number; maxLength?: number; pattern?: string; $ref?: string }>;
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    put?: {
                        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    get?: unknown;
                    post?: unknown;
                    patch?: unknown;
                    delete?: unknown;
                    options?: unknown;
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
        const missingRoutes = readJson<{
            routes?: string[];
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                path?: string;
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

        assert.match(routeSource, /router\.put\(\s*["']\/["']/);
        assert.match(routeSource, /requestBody:\s*"SafetyHubSuspendedClassificationReviewSchema"/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(get|post|patch|delete|options|head)\(/);

        assert.equal(schemas.SafetyHubSuspendedClassificationReviewSchema?.type, "object");
        assert.deepEqual(schemas.SafetyHubSuspendedClassificationReviewSchema?.required, ["signal", "token", "user_input"]);
        assert.equal(schemas.SafetyHubSuspendedClassificationReviewSchema?.properties?.token?.minLength, 1);
        assert.equal(schemas.SafetyHubSuspendedClassificationReviewSchema?.properties?.token?.maxLength, 4096);
        assert.equal(schemas.SafetyHubSuspendedClassificationReviewSchema?.properties?.signal?.$ref, "#/definitions/AppealIngestionSignal");
        assert.equal(schemas.SafetyHubSuspendedClassificationReviewSchema?.properties?.user_input?.maxLength, 1000);
        assert.deepEqual(schemas.AppealIngestionSignal?.enum, [0, 1, 2, 3]);
        assert.equal(schemas.SafetyHubClassificationReviewResponse?.properties?.appeal_id?.pattern, "^\\d{1,20}$");

        const openapiRoute = openapi.paths?.["/safety-hub/suspended/request-review/{classification_id}/"]?.put;
        assert.equal(openapiRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/SafetyHubSuspendedClassificationReviewSchema");
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/SafetyHubClassificationReviewResponse");
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.security, undefined);
        assert.equal(openapi.paths?.["/safety-hub/suspended/request-review/{classification_id}/"]?.post, undefined);
        assert.equal(openapi.paths?.["/safety-hub/suspended/request-review/{classification_id}/"]?.get, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "PUT" && entry.route === "/safety-hub/suspended/request-review/{classification_id}");
        assert.equal(sourceRoute?.route_name, "PUT_SAFETY_HUB_SUSPENDED_REQUEST_REVIEW_CLASSIFICATION_ID");
        assert.equal(sourceRoute?.source, "src/api/routes/safety-hub/suspended/request-review/#classification_id.ts");
        assert.equal(sourceRoute?.request_schema_ref, "SafetyHubSuspendedClassificationReviewSchema");
        assert.deepEqual(sourceRoute?.response_schema_refs, ["APIErrorResponse", "SafetyHubClassificationReviewResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) =>
                    entry.method === "PUT" &&
                    entry.route === "/safety-hub/suspended/request-review/{param}" &&
                    entry.route_name === "PUT_SAFETY_HUB_SUSPENDED_REQUEST_REVIEW_CLASSIFICATION_ID",
            ),
            false,
        );
        assert.equal(missingRoutes.routes?.includes("/safety-hub/suspended/request-review/{param}"), false);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/safety-hub/suspended/request-review/#classification_id.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "SafetyHubSuspendedClassificationReviewSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse", "SafetyHubClassificationReviewResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 404, 501]);

        const contractEntry = contractMatrix.contracts?.find((contract) => contract.manifestId === manifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/safety-hub/suspended/request-review/#classification_id.ts");
        assert.equal(contractEntry?.routeMetadata?.requestBody, "SafetyHubSuspendedClassificationReviewSchema");
        assert.deepEqual(contractEntry?.routeMetadata?.responses, ["APIErrorResponse", "SafetyHubClassificationReviewResponse"]);
        assert.deepEqual(contractEntry?.routeMetadata?.responseStatuses, [200, 400, 404, 501]);
    });
});

function loadRouteModule(): typeof import("./#classification_id") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./#classification_id");
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

function reviewBody(overrides: Record<string, unknown> = {}) {
    return {
        token: "suspended-token",
        signal: 1,
        user_input: "I do not agree with this classification.",
        ...overrides,
    };
}

async function requestJson(
    app: express.Express,
    routePath: string,
    options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: unknown }> {
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
            body: (await response.json()) as unknown,
        };
    } finally {
        server.close();
    }
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}
