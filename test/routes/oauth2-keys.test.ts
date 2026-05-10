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
import { join } from "node:path";
import { describe, test } from "node:test";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import keysRouter, { getOAuth2OpenIdConnectKeySet } from "../../src/api/routes/oauth2/keys";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: boolean;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

describe("GET /oauth2/keys", () => {
    test("returns the conservative local OpenID Connect JWKS", () => {
        assert.deepEqual(getOAuth2OpenIdConnectKeySet(), {
            keys: [],
        });
    });

    test("is public through the authentication middleware and returns a cacheable JWKS object", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/oauth2/keys"), true);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/oauth2/keys/"), true);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/oauth2/keys"), false);

        const response = await requestJson(createRouteApp(), "/oauth2/keys");

        assert.equal(response.status, 200);
        assert.match(response.headers["cache-control"] ?? "", /^public, max-age=300$/);
        assert.deepEqual(response.body, {
            keys: [],
        });
    });

    test("declares the public JWKS response schema without private key fields", () => {
        const schemas = readSchemas();
        const response = schemas.OAuth2KeysResponse;
        const jwk = schemas.OAuth2JsonWebKey;

        assert.deepEqual(response.required, ["keys"]);
        assert.equal(response.properties?.keys?.type, "array");
        assert.equal(response.properties?.keys?.items?.$ref, "#/definitions/OAuth2JsonWebKey");
        assert.equal(jwk.required?.includes("kty"), true);
        assert.equal(jwk.properties?.kty?.type, "string");
        assert.equal(jwk.properties?.d, undefined);
        assert.equal(jwk.properties?.p, undefined);
        assert.equal(jwk.properties?.q, undefined);
        assert.equal(jwk.additionalProperties, false);
    });

    test("generated schemas validate empty JWKS responses and reject private key material", () => {
        const schemaJson = readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8");
        const schemas = JSON.parse(schemaJson.replaceAll("#/definitions/", "")) as Record<string, AnySchema>;
        const ajv = new Ajv({
            allErrors: true,
            allowUnionTypes: true,
            schemas,
            strict: true,
            strictRequired: true,
        });
        addFormats(ajv);

        const validate = ajv.getSchema("OAuth2KeysResponse");
        assert.ok(validate);
        assert.equal(validate({ keys: [] }), true, JSON.stringify(validate.errors, null, 2));
        assert.equal(
            validate({
                keys: [
                    {
                        kty: "EC",
                        use: "sig",
                        kid: "key-id",
                        alg: "ES512",
                        crv: "P-521",
                        x: "public-x",
                        y: "public-y",
                        d: "private-scalar",
                    },
                ],
            }),
            false,
        );
    });

    test("declares public response metadata in generated route artifacts", () => {
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            response_schema_refs?: string[];
        }[];

        const route = openapi.paths?.["/oauth2/keys/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/OAuth2KeysResponse");
        assert.equal(route?.responses?.["401"], undefined);
        assert.equal(route?.security, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/oauth2/keys/");
        assert.equal(manifestEntry?.authMode, "public");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["OAuth2KeysResponse"]);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200]);

        const sourceCatalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/oauth2/keys");
        assert.equal(sourceCatalogEntry?.route_name, "GET_OAUTH2_KEYS");
        assert.deepEqual(sourceCatalogEntry?.response_schema_refs, ["OAuth2KeysResponse"]);
    });
});

function readSchemas() {
    return JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
}

function createRouteApp() {
    const app = express();
    app.use(Authentication);
    app.use("/oauth2/keys", keysRouter);
    app.use(ErrorHandler);

    return app;
}

async function requestJson<TBody = unknown>(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            headers: Object.fromEntries(response.headers),
            body: (await response.json()) as TBody,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
