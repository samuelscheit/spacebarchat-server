/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTIBILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import claimedPromotionCodesRouter, {
    createCurrentUserClaimedOutboundPromotionCodesRouter,
    getCurrentUserClaimedOutboundPromotionCodes,
} from "../../src/api/routes/users/@me/outbound-promotions/codes";

const coveredManifestIds = ["api:http:GET:/users/@me/outbound-promotions/codes/"];
const assignedSourcePath = "/users/@me/outbound-promotions/codes";
const assignedRouteName = "GET_USERS__ME_OUTBOUND_PROMOTIONS_CODES";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

describe("GET /users/@me/outbound-promotions/codes", () => {
    test("documents the assigned route identity and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/outbound-promotions/codes/"]);
        assert.equal(assignedSourcePath, "/users/@me/outbound-promotions/codes");
        assert.equal(assignedRouteName, "GET_USERS__ME_OUTBOUND_PROMOTIONS_CODES");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/outbound-promotions/codes?locale=en-US"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/users/@me/outbound-promotions/codes/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/users/@me/outbound-promotions/codes"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/outbound-promotions/codes?locale=en-US");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns the narrow locally backed current-user claimed-code list", async () => {
        assert.deepEqual(getCurrentUserClaimedOutboundPromotionCodes("100000000000000001"), []);
        assert.notEqual(
            getCurrentUserClaimedOutboundPromotionCodes("100000000000000001"),
            getCurrentUserClaimedOutboundPromotionCodes("100000000000000001"),
            "callers should receive a fresh claimed-promotion array",
        );

        const response = await requestJson(createRouteApp(), "/users/@me/outbound-promotions/codes?locale=en-US");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("declares source-backed metadata and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "outbound-promotions", "codes.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; schema?: JsonSchema }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(join(process.cwd(), "assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                response_schema_refs?: string[];
                route?: string;
                route_name?: string;
                source?: string;
            }[]
        >(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const manifest = readJson<{
            entries?: {
                authMode?: string;
                id?: string;
                path?: string;
                routeMetadata?: {
                    hasQuery?: boolean;
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: {
                authMode?: string;
                manifestId?: string;
                path?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Get Claimed Promotions"/);
        assert.match(routeSource, /description:\s*"Returns locally backed claimed outbound promotions for the current user without fabricating Discord promotion-code state\."/);
        assert.match(routeSource, /locale:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"ClaimedPromotionsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.post|promotion_id|reward|billing|subscription/);

        assert.equal(schemas.ClaimedPromotionsResponse.type, "array");
        assert.equal(schemas.ClaimedPromotionsResponse.items?.$ref, "#/definitions/ClaimedPromotionResponse");
        assert.deepEqual(schemas.ClaimedPromotionResponse.required?.sort(), ["claimed_at", "code", "promotion", "user_id"]);
        assert.equal(schemas.ClaimedPromotionResponse.properties?.promotion?.$ref, "#/definitions/PromotionResponse");
        assert.equal(schemas.PromotionResponse.properties?.outbound_redemption_url_format?.type, "string");

        const route = openapi.paths?.["/users/@me/outbound-promotions/codes/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ClaimedPromotionsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(
            route?.parameters?.some((parameter) => parameter.name === "locale" && parameter.in === "query" && parameter.schema?.type === "string"),
            true,
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(sourceEntry?.route_name, assignedRouteName);
        assert.equal(sourceEntry?.source, "src/api/routes/users/@me/outbound-promotions/codes.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "ClaimedPromotionsResponse"]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/users/@me/outbound-promotions/codes/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/outbound-promotions/codes.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "ClaimedPromotionsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/users/@me/outbound-promotions/codes/");
        assert.equal(contract?.routeMetadata?.responses?.includes("ClaimedPromotionsResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === assignedRouteName),
            false,
        );
    });
});

function createRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/users/@me/outbound-promotions/codes", createCurrentUserClaimedOutboundPromotionCodesRouter());
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/outbound-promotions/codes", claimedPromotionCodesRouter);
    app.use(ErrorHandler);

    return app;
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function requestJson(app: express.Express, path: string) {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${path}`);

        return {
            status: response.status,
            headers: response.headers,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
