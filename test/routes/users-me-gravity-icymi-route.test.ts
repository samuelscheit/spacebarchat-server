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
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import gravityIcyMiRouter, {
    EMPTY_GRAVITY_ICYMI_LOAD_ID,
    createCurrentUserGravityIcyMiRouter,
    getCurrentUserGravityIcyMiResponse,
} from "../../src/api/routes/users/@me/gravity-icymi";

const coveredManifestIds = ["api:http:GET:/users/@me/gravity-icymi/"];
const assignedSourcePath = "/users/@me/gravity-icymi";
const assignedSourceRouteName = "GET_USERS__ME_GRAVITY_ICYMI";
const xhyromRouteName = "GRAVITY_ITEMS_DEHYDRATED";
const sourceFile = "src/api/routes/users/@me/gravity-icymi.ts";

type JsonSchema = {
    $ref?: string;
    additionalProperties?: JsonSchema | boolean;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

describe("GET /users/@me/gravity-icymi", () => {
    test("documents the assigned route identity, source evidence, and bearer auth boundary", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/gravity-icymi/"]);
        assert.equal(assignedSourcePath, "/users/@me/gravity-icymi");
        assert.equal(assignedSourceRouteName, "GET_USERS__ME_GRAVITY_ICYMI");
        assert.equal(xhyromRouteName, "GRAVITY_ITEMS_DEHYDRATED");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/gravity-icymi"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/users/@me/gravity-icymi/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/users/@me/gravity-icymi"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/gravity-icymi");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns the empty locally backed Gravity ICYMI envelope without fabricated feed items", async () => {
        assert.deepEqual(getCurrentUserGravityIcyMiResponse("100000000000000001"), {
            items: [],
            load_id: EMPTY_GRAVITY_ICYMI_LOAD_ID,
        });
        assert.notEqual(
            getCurrentUserGravityIcyMiResponse("100000000000000001"),
            getCurrentUserGravityIcyMiResponse("100000000000000001"),
            "callers should receive a fresh response object",
        );

        const response = await requestJson(createRouteApp(), "/users/@me/gravity-icymi?refresh=true");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            items: [],
            load_id: EMPTY_GRAVITY_ICYMI_LOAD_ID,
        });
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("declares source-backed metadata and generated artifacts without taking adjacent Gravity routes", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "gravity-icymi.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { in?: string; name?: string; schema?: { type?: string } }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: unknown;
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
        const xhyromCatalog = readJson<{ method?: string; route?: string; route_name?: string; source?: string }[]>(
            join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.xhyrom.catalog.json"),
        );
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
                sourceFile?: string;
            }[];
        }>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[] }[] }[] }>(join(process.cwd(), "test", "generated", "suite-coverage.json"));
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Get Current User Gravity ICYMI Items"/);
        assert.match(routeSource, /description:\s*"Returns the current user's locally backed Gravity ICYMI item envelope without fabricating Discord private feed state\."/);
        assert.match(routeSource, /refresh:\s*\{\s*type:\s*"boolean"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GravityIcyMiResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(post|patch|put|delete)\(/);
        assert.doesNotMatch(routeSource, /gravity-attachments|gravity-attachments-upload|gravity-content|gravity-join|CloudAttachment|Message\.|Guild\./i);

        assert.equal(schemas.GravityIcyMiResponse.type, "object");
        assert.deepEqual(schemas.GravityIcyMiResponse.required?.sort(), ["items", "load_id"]);
        assert.equal(schemas.GravityIcyMiResponse.properties?.items?.type, "array");
        assert.equal(schemas.GravityIcyMiResponse.properties?.items?.items?.$ref, "#/definitions/GravityIcyMiDehydratedItem");
        assert.equal(schemas.GravityIcyMiResponse.properties?.load_id?.type, "string");
        assert.equal(schemas.GravityIcyMiDehydratedItem.type, "object");
        assert.deepEqual(schemas.GravityIcyMiDehydratedItem.required?.sort(), ["id", "type"]);
        assert.equal(schemas.GravityIcyMiDehydratedItem.properties?.data?.$ref, "#/definitions/GravityIcyMiItemData");
        assert.equal(schemas.GravityIcyMiItemData.additionalProperties && typeof schemas.GravityIcyMiItemData.additionalProperties !== "boolean", true);
        assert.equal(schemas.GravityIcyMiItemData.properties?.message_context?.$ref, "#/definitions/GravityIcyMiMessageContext");

        const route = openapi.paths?.["/users/@me/gravity-icymi/"];
        assert.equal(route?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GravityIcyMiResponse");
        assert.equal(route?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.get?.security, [{ bearer: [] }]);
        assert.equal(
            route?.get?.parameters?.some((parameter) => parameter.in === "query" && parameter.name === "refresh" && parameter.schema?.type === "boolean"),
            true,
        );
        assert.equal(route?.post, undefined);

        const xhyromEntries = xhyromCatalog.filter((entry) => entry.route === assignedSourcePath);
        assert.deepEqual(xhyromEntries.map((entry) => entry.method).sort(), ["GET", "HEAD", "OPTIONS"]);
        assert.equal(
            xhyromEntries.some((entry) => entry.method === "GET" && entry.route_name === xhyromRouteName),
            true,
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(sourceEntry?.route_name, assignedSourceRouteName);
        assert.equal(sourceEntry?.source, sourceFile);
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GravityIcyMiResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "POST" && entry.route === assignedSourcePath),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/users/@me/gravity-icymi/");
        assert.equal(manifestEntry?.sourceFile, sourceFile);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "GravityIcyMiResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/users/@me/gravity-icymi/");
        assert.equal(contract?.sourceFile, sourceFile);
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "GravityIcyMiResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(coveredManifestIds[0]), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === xhyromRouteName),
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
    app.use("/users/@me/gravity-icymi", createCurrentUserGravityIcyMiRouter());
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/gravity-icymi", gravityIcyMiRouter);
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
