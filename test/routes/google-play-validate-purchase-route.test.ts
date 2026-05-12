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
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { nonCoercingAjv } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import googlePlayValidatePurchaseRouter, {
    GOOGLE_PLAY_VALIDATE_PURCHASE_UNSUPPORTED_MESSAGE,
    createGooglePlayValidatePurchaseUnsupportedError,
} from "../../src/api/routes/google-play/validate-purchase";

const coveredManifestIds = ["api:http:POST:/google-play/validate-purchase/"];

describe("POST /google-play/validate-purchase", () => {
    test("declares the assigned manifest route id", () => {
        assert.deepEqual(coveredManifestIds, ["api:http:POST:/google-play/validate-purchase/"]);
    });

    test("stays behind bearer authentication", async () => {
        const app = express();
        app.use(express.json());
        app.use(Authentication);
        app.use("/google-play/validate-purchase", googlePlayValidatePurchaseRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/google-play/validate-purchase", {
            method: "POST",
            body: { purchase_token: "google-play-token" },
        });

        assert.equal(isNoAuthorizationRoute("POST", "/google-play/validate-purchase"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/google-play/validate-purchase"), false);
        assert.equal(response.status, 401);
        assert.equal(response.body.code, 401);
        assert.equal(response.body.message, "Error: Missing Authorization Header");
    });

    test("validates purchase-token payloads without scalar coercion", async () => {
        const validate = nonCoercingAjv.getSchema("GooglePlayValidatePurchaseSchema");
        assert.ok(validate);

        assert.equal(validate({ purchase_token: "google-play-token" }), true, JSON.stringify(validate.errors));
        assert.equal(
            validate({
                purchase_token: "google-play-token",
                sku_id: "premium.monthly",
                package_name: "com.discord",
                raw_client_payload: { source: "android" },
            }),
            true,
            JSON.stringify(validate.errors),
        );
        assert.equal(validate({}), false);
        assert.equal(validate({ purchase_token: "" }), false);
        assert.equal(validate({ purchase_token: 123 }), false);
        assert.equal(validate({ sku_id: "premium.monthly" }), false);

        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/google-play/validate-purchase", {
            method: "POST",
            body: { sku_id: "premium.monthly" },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, DiscordApiErrors.INVALID_FORM_BODY.code);
        assert.equal(response.body.message, "Invalid Form Body");
        assert.equal(typeof response.body.errors, "object");
    });

    test("fails closed instead of fabricating commerce state", async () => {
        const app = setupAuthenticatedRoute();
        const response = await requestJson(app, "/google-play/validate-purchase", {
            method: "POST",
            body: {
                purchase_token: "google-play-token",
                sku_id: "premium.monthly",
                package_name: "com.discord",
            },
        });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: GOOGLE_PLAY_VALIDATE_PURCHASE_UNSUPPORTED_MESSAGE,
        });
    });

    test("uses an explicit unsupported-provider API error", () => {
        const error = createGooglePlayValidatePurchaseUnsupportedError();

        assert.equal(error.code, 0);
        assert.equal(error.httpStatus, 501);
        assert.equal(error.message, GOOGLE_PLAY_VALIDATE_PURCHASE_UNSUPPORTED_MESSAGE);
    });

    test("documents route metadata and Google Play support limits", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "google-play", "validate-purchase.ts"), "utf8");
        const schemaSource = readFileSync(path.join(process.cwd(), "src", "schemas", "uncategorised", "GooglePlayValidatePurchaseSchema.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Validate Google Play Purchase"/);
        assert.match(routeSource, /requestBody:\s*"GooglePlayValidatePurchaseSchema"/);
        assert.match(routeSource, /Google Play Developer API credentials/);
        assert.match(routeSource, /replay protection/);
        assert.match(routeSource, /durable entitlement\/subscription state/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.match(routeSource, /router\.post\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(get|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /verify-purchase-token|downgrade-subscription/);

        assert.match(schemaSource, /purchase_token:\s*string/);
        assert.match(schemaSource, /@minLength 1/);
        assert.match(schemaSource, /@maxLength 4096/);
        assert.match(schemaSource, /\[key: string\]: JsonValue \| undefined/);
    });

    test("generates source catalog, missing-route, OpenAPI, testing manifest, and contract metadata", () => {
        const sourceCatalog = readJson<
            {
                method?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
        const schemas = readJson<
            Record<
                string,
                {
                    properties?: Record<string, { maxLength?: number; minLength?: number; type?: string }>;
                    required?: string[];
                    type?: string;
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    delete?: unknown;
                    get?: unknown;
                    patch?: unknown;
                    post?: {
                        requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    put?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const testingManifest = readJson<{
            entries?: {
                authMode?: string;
                coverage?: { policyId?: string; testTier?: string };
                id?: string;
                routeMetadata?: {
                    hasQuery?: boolean;
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                manifestId?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseStatuses?: number[];
                    responses?: string[];
                };
                sourceFile?: string;
            }[];
        }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[]; testFiles?: string[] }[] }[] }>(
            path.join("test", "generated", "suite-coverage.json"),
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/google-play/validate-purchase");
        assert.equal(sourceEntry?.route_name, "POST_GOOGLE_PLAY_VALIDATE_PURCHASE");
        assert.equal(sourceEntry?.source, "src/api/routes/google-play/validate-purchase.ts");
        assert.equal(sourceEntry?.request_schema_ref, "GooglePlayValidatePurchaseSchema");
        assert.deepEqual(sourceEntry?.response_schema_refs, ["APIErrorResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some(
                (entry) => entry.method === "POST" && entry.route === "/google-play/validate-purchase" && entry.route_name === "GOOGLE_PLAY_VALIDATE_PURCHASE",
            ),
            false,
        );

        assert.equal(schemas.GooglePlayValidatePurchaseSchema?.type, "object");
        assert.deepEqual(schemas.GooglePlayValidatePurchaseSchema?.required, ["purchase_token"]);
        assert.equal(schemas.GooglePlayValidatePurchaseSchema?.properties?.purchase_token?.type, "string");
        assert.equal(schemas.GooglePlayValidatePurchaseSchema?.properties?.purchase_token?.minLength, 1);

        const postRoute = openapi.paths?.["/google-play/validate-purchase/"]?.post;
        assert.equal(postRoute?.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GooglePlayValidatePurchaseSchema");
        assert.equal(postRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(postRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(postRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(postRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/google-play/validate-purchase/"]?.get, undefined);
        assert.equal(openapi.paths?.["/google-play/validate-purchase/"]?.put, undefined);
        assert.equal(openapi.paths?.["/google-play/validate-purchase/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/google-play/validate-purchase/"]?.delete, undefined);

        const manifestEntry = testingManifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/google-play/validate-purchase.ts");
        assert.equal(manifestEntry?.coverage?.policyId, "api-google-play-commerce");
        assert.equal(manifestEntry?.coverage?.testTier, "stateful-domain");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "GooglePlayValidatePurchaseSchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [400, 401, 501]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.sourceFile, "src/api/routes/google-play/validate-purchase.ts");
        assert.equal(contract?.routeMetadata?.requestBody, "GooglePlayValidatePurchaseSchema");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [400, 401, 501]);

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(coveredManifestIds[0]), true);
        assert.equal(usersSuite?.testFiles?.includes("test/routes/google-play-validate-purchase-route.test.ts"), true);
    });
});

function setupAuthenticatedRoute() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/google-play/validate-purchase", googlePlayValidatePurchaseRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string, options: { body?: unknown; method?: string } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            headers: options.body === undefined ? undefined : { "content-type": "application/json" },
            method: options.method,
        });

        return {
            body: (await response.json()) as Record<string, unknown>,
            status: response.status,
        };
    } finally {
        await closeServer(server);
    }
}

async function closeServer(server: ReturnType<express.Express["listen"]>) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as T;
}
