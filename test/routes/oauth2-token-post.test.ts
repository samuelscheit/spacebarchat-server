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
import http from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import { isNoAuthorizationRoute } from "../../src/api/middlewares/NoAuthorizationRoutes";
import oauth2TokenRouter, { getOAuth2FormField, isOAuth2TokenFormContentType, isOAuth2TokenGrantType, parseOAuth2BasicCredentials } from "../../src/api/routes/oauth2/token";

const manifestId = "api:http:POST:/oauth2/token/";
const assignedPath = "/oauth2/token";
const routeSourceFile = "src/api/routes/oauth2/token.ts";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function createApp() {
    const app = express();
    app.use("/oauth2/token", oauth2TokenRouter);
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, body: string, headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" }) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/oauth2/token`, {
            method: "POST",
            headers,
            body,
        });
        const responseText = await response.text();
        return {
            status: response.status,
            body: responseText ? (JSON.parse(responseText) as Record<string, unknown>) : undefined,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

describe("POST /oauth2/token", () => {
    test("declares only the assigned singular token route as public", () => {
        assert.equal(isNoAuthorizationRoute("POST", "/oauth2/token"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v10/oauth2/token/"), true);
        assert.equal(isNoAuthorizationRoute("GET", "/oauth2/token"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/oauth2/token/revoke"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/oauth2/tokens"), false);
    });

    test("parses supported grant names, form content type, and optional basic credentials", () => {
        assert.equal(isOAuth2TokenGrantType("authorization_code"), true);
        assert.equal(isOAuth2TokenGrantType("refresh_token"), true);
        assert.equal(isOAuth2TokenGrantType("client_credentials"), true);
        assert.equal(isOAuth2TokenGrantType("urn:ietf:params:oauth:grant-type:device_code"), true);
        assert.equal(isOAuth2TokenGrantType("password"), false);

        assert.equal(isOAuth2TokenFormContentType("application/x-www-form-urlencoded; charset=utf-8"), true);
        assert.equal(isOAuth2TokenFormContentType("application/json"), false);

        assert.deepEqual(parseOAuth2BasicCredentials(`Basic ${Buffer.from("client-id:client-secret").toString("base64")}`), {
            client_id: "client-id",
            client_secret: "client-secret",
        });
        assert.deepEqual(parseOAuth2BasicCredentials(`Basic ${Buffer.from("client-id:secret:with:colons").toString("base64")}`), {
            client_id: "client-id",
            client_secret: "secret:with:colons",
        });
        assert.equal(parseOAuth2BasicCredentials("Bearer token"), undefined);
    });

    test("rejects JSON bodies with OAuth error format", async () => {
        const response = await requestJson(createApp(), JSON.stringify({ grant_type: "client_credentials" }), { "content-type": "application/json" });

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            error: "invalid_request",
            error_description: "OAuth2 token requests must use application/x-www-form-urlencoded.",
        });
    });

    test("rejects missing and duplicate grant_type fields", async () => {
        const missingResponse = await requestJson(createApp(), "client_id=100000000000000001");
        const duplicateResponse = await requestJson(createApp(), "grant_type=client_credentials&grant_type=refresh_token");

        assert.equal(missingResponse.status, 400);
        assert.deepEqual(missingResponse.body, {
            error: "invalid_request",
            error_description: "The grant_type form field is required.",
        });

        assert.equal(duplicateResponse.status, 400);
        assert.deepEqual(duplicateResponse.body, {
            error: "invalid_request",
            error_description: "The grant_type form field must be provided exactly once.",
        });
        assert.throws(() => getOAuth2FormField({ grant_type: ["client_credentials", "refresh_token"] }, "grant_type"), {
            message: "The grant_type form field must be provided exactly once.",
        });
    });

    test("rejects unknown grant types before any local token issuance", async () => {
        const response = await requestJson(createApp(), "grant_type=password&client_id=100000000000000001");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            error: "unsupported_grant_type",
            error_description: "Unsupported OAuth2 grant_type: password",
        });
    });

    test("fails closed for documented grants that require absent durable OAuth state", async () => {
        const grantBodies = [
            "grant_type=authorization_code&client_id=100000000000000001&client_secret=secret&code=code&redirect_uri=https%3A%2F%2Fexample.test%2Fcallback",
            "grant_type=refresh_token&client_id=100000000000000001&client_secret=secret&refresh_token=refresh",
            "grant_type=client_credentials&client_id=100000000000000001&client_secret=secret&scope=identify",
            "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&client_id=100000000000000001&client_secret=secret&device_code=device",
        ];

        for (const body of grantBodies) {
            const response = await requestJson(createApp(), body);

            assert.equal(response.status, 400);
            assert.equal(response.body?.error, "unsupported_grant_type");
            assert.match(String(response.body?.error_description), /does not currently persist OAuth2 authorization grants/);
        }
    });

    test("documents route metadata and OAuth response schemas", () => {
        const routeSource = readFileSync(join(process.cwd(), routeSourceFile), "utf8");

        assert.match(routeSource, /summary:\s*"Get OAuth2 Token"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"OAuth2TokenResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"OAuth2TokenErrorResponse"/s);
        assert.doesNotMatch(routeSource, /401:\s*\{/);
        assert.doesNotMatch(routeSource, /token\/revoke/);
    });

    test("generates source catalog, missing-route, OpenAPI, manifest, contract, and schema metadata", () => {
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(
            join(process.cwd(), "packages", "missing-routes", "missing.json"),
        );
        const openapi = readJson<{
            components?: { schemas?: Record<string, JsonSchema> };
            paths?: Record<
                string,
                {
                    post?: {
                        requestBody?: unknown;
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                routeMetadata?: {
                    requestBody?: string;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
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

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === assignedPath);
        assert.equal(sourceEntry?.route_name, "POST_OAUTH2_TOKEN");
        assert.equal(sourceEntry?.source, routeSourceFile);
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["OAuth2TokenErrorResponse", "OAuth2TokenResponse"]);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedPath && entry.route_name === "POST_OAUTH2_TOKEN"),
            false,
        );

        const route = openapi.paths?.["/oauth2/token/"]?.post;
        assert.equal(route?.security, undefined);
        assert.equal(route?.requestBody, undefined);
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/OAuth2TokenResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/OAuth2TokenErrorResponse");

        const tokenSchema = openapi.components?.schemas?.OAuth2TokenResponse;
        assert.deepEqual(tokenSchema?.required?.sort(), ["access_token", "expires_in", "scope", "token_type"]);
        assert.equal(tokenSchema?.properties?.refresh_token?.type, "string");
        assert.equal(openapi.components?.schemas?.OAuth2TokenErrorResponse?.required?.includes("error"), true);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "public");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["OAuth2TokenErrorResponse", "OAuth2TokenResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "public");
        assert.equal(contract?.routeMetadata?.requestBody, undefined);
        assert.deepEqual(contract?.routeMetadata?.responses, ["OAuth2TokenErrorResponse", "OAuth2TokenResponse"]);
        assert.deepEqual(contract?.routeMetadata?.responseStatuses, [200, 400]);
    });
});
