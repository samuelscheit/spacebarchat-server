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
import videoFilterAssetsRouter, {
    createCurrentUserVideoFilterAssetsRouter,
    getCurrentUserVideoFilterAssets,
    type CurrentUserVideoFilterAssetsProvider,
} from "../../src/api/routes/users/@me/video-filters/assets";

const coveredManifestIds = ["api:http:GET:/users/@me/video-filters/assets/"];
const assignedSourcePath = "/users/@me/video-filters/assets";
const assignedSourceRouteName = "GET_USERS__ME_VIDEO_FILTERS_ASSETS";
const xhyromRouteName = "VIDEO_FILTER_ASSETS";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

describe("GET /users/@me/video-filters/assets", () => {
    test("documents the assigned route identity, source evidence, and bearer auth boundary", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/video-filters/assets/"]);
        assert.equal(assignedSourcePath, "/users/@me/video-filters/assets");
        assert.equal(assignedSourceRouteName, "GET_USERS__ME_VIDEO_FILTERS_ASSETS");
        assert.equal(xhyromRouteName, "VIDEO_FILTER_ASSETS");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/video-filters/assets"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v9/users/@me/video-filters/assets/"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/users/@me/video-filters/assets"), false);
        assert.equal(isNoAuthorizationRoute("DELETE", "/api/v9/users/@me/video-filters/assets/123"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/video-filters/assets");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns an empty locally backed current-user video filter asset list", async () => {
        assert.deepEqual(getCurrentUserVideoFilterAssets("100000000000000001"), []);
        assert.notEqual(getCurrentUserVideoFilterAssets("100000000000000001"), getCurrentUserVideoFilterAssets("100000000000000001"), "callers should receive a fresh asset array");

        const response = await requestJson(createRouteApp(), "/users/@me/video-filters/assets");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    });

    test("passes current-user context to custom asset providers and serializes only supported asset fields", async () => {
        let receivedUserId: string | undefined;
        const provider: CurrentUserVideoFilterAssetsProvider = (userId) => {
            receivedUserId = userId;
            const assets = [
                {
                    id: "200000000000000002",
                    asset_hash: "fed43ab12698df65902ba06727e20c0e",
                    extra: "ignored",
                },
            ];

            return assets;
        };

        const response = await requestJson(createRouteApp(provider), "/users/@me/video-filters/assets");

        assert.equal(response.status, 200);
        assert.equal(receivedUserId, "100000000000000001");
        assert.deepEqual(response.body, [
            {
                id: "200000000000000002",
                asset_hash: "fed43ab12698df65902ba06727e20c0e",
            },
        ]);
    });

    test("declares source-backed metadata and generated artifacts for the exact owned GET route", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "video-filters", "assets.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    delete?: unknown;
                    get?: {
                        parameters?: unknown[];
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
        const missingRoutes = readJson<{
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        }>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
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
        const suiteCoverage = readJson<{ groups?: { suites?: { id?: string; manifestIds?: string[] }[] }[] }>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /summary:\s*"Get Video Filter Assets"/);
        assert.match(
            routeSource,
            /description:\s*"Returns the current user's locally backed custom video-filter background assets without fabricating Discord private client media state\."/,
        );
        assert.match(routeSource, /200:\s*\{\s*body:\s*"VideoFilterAssetsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(post|patch|put|delete)\(/);
        assert.doesNotMatch(routeSource, /upload|thumbnail|media[-_ ]processing|subscription|nitro|billing|payment|last-used/i);

        assert.equal(schemas.VideoFilterAssetsResponse.type, "array");
        assert.equal(schemas.VideoFilterAssetsResponse.items?.$ref, "#/definitions/VideoFilterAssetResponse");
        assert.deepEqual(schemas.VideoFilterAssetResponse.required?.sort(), ["asset_hash", "id"]);
        assert.equal(schemas.VideoFilterAssetResponse.properties?.id?.type, "string");
        assert.equal(schemas.VideoFilterAssetResponse.properties?.asset_hash?.type, "string");

        const route = openapi.paths?.["/users/@me/video-filters/assets/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/VideoFilterAssetsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(route?.parameters?.length ?? 0, 0);
        assert.equal(openapi.paths?.["/users/@me/video-filters/assets/"]?.post, undefined);
        assert.equal(openapi.paths?.["/users/@me/video-filters/assets/"]?.delete, undefined);
        assert.equal(openapi.paths?.["/users/@me/video-filters/assets/{param}/last-used/"], undefined);

        const xhyromEntries = xhyromCatalog.filter((entry) => entry.route === assignedSourcePath);
        assert.deepEqual(xhyromEntries.map((entry) => entry.method).sort(), ["GET", "HEAD", "OPTIONS", "POST"]);
        assert.equal(
            xhyromEntries.some((entry) => entry.method === "GET" && entry.route_name === xhyromRouteName),
            true,
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedSourcePath);
        assert.equal(sourceEntry?.route_name, assignedSourceRouteName);
        assert.equal(sourceEntry?.source, "src/api/routes/users/@me/video-filters/assets.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "VideoFilterAssetsResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => entry.method === "POST" && entry.route === assignedSourcePath),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.route === `${assignedSourcePath}/{param}`),
            false,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.route === `${assignedSourcePath}/{param}/last-used`),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === assignedSourcePath && entry.route_name === xhyromRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === assignedSourcePath && entry.route_name === xhyromRouteName),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === `${assignedSourcePath}/{param}`),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.route === `${assignedSourcePath}/{param}/last-used`),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.path, "/users/@me/video-filters/assets/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/video-filters/assets.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "VideoFilterAssetsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestIds[0]);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.path, "/users/@me/video-filters/assets/");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "VideoFilterAssetsResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const usersSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "users");
        assert.equal(usersSuite?.manifestIds?.includes(coveredManifestIds[0]), true);
    });
});

function createRouteApp(provider?: CurrentUserVideoFilterAssetsProvider) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "100000000000000001";
        next();
    });
    app.use("/users/@me/video-filters/assets", createCurrentUserVideoFilterAssetsRouter(provider));
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/video-filters/assets", videoFilterAssetsRouter);
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
