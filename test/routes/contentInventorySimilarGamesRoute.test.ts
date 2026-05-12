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
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { isNoAuthorizationRoute } from "../../src/api/middlewares";
import similarGamesRouter, { buildContentInventorySimilarGamesResponse } from "../../src/api/routes/content-inventory/users/@me/similar-games/#application_id";

const coveredManifestId = "api:http:GET:/content-inventory/users/@me/similar-games/:application_id/";
const sourceRoutePath = "src/api/routes/content-inventory/users/@me/similar-games/#application_id.ts";

describe("GET /content-inventory/users/@me/similar-games/:application_id", () => {
    test("returns the current conservative empty similar game collection for the current user", async () => {
        const first = buildContentInventorySimilarGamesResponse("user-id", "1217877285923979415");
        const second = buildContentInventorySimilarGamesResponse("user-id", "1217877285923979415");

        first.push({ application_id: "1217877285923979415" });

        assert.deepEqual(second, []);

        const app = express();
        app.use((req, _res, next) => {
            req.user_id = "user-id";
            next();
        });
        app.use("/content-inventory/users/@me/similar-games/:application_id", similarGamesRouter);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/content-inventory/users/@me/similar-games/1217877285923979415`);

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), []);
        } finally {
            await close(server);
        }
    });

    test("stays on the authenticated current-user route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/content-inventory/users/@me/similar-games/1217877285923979415"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/content-inventory/users/@me/similar-games/1217877285923979415"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/content-inventory/users/@me/similar-games/1217877285923979415"), false);
    });

    test("declares source metadata for the xHyroM SIMILAR_GAMES compatibility route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), sourceRoutePath), "utf-8");

        assert.match(routeSource, /summary:\s*"Get Similar Games"/);
        assert.match(routeSource, /body:\s*"ContentInventorySimilarGamesResponse"/);
        assert.match(routeSource, /body:\s*"APIErrorResponse"/);
        assert.match(routeSource, /does not currently persist source-backed content inventory recommendation state/);
    });

    test("is present in regenerated route artifacts and removed from missing routes", () => {
        const catalog = readJson<
            Array<{
                method: string;
                response_schema_refs?: string[];
                route: string;
                route_name: string;
                source: string;
            }>
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{
            missing_entries?: Array<{
                method?: string;
                route?: string;
                route_name?: string;
            }>;
        }>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: Array<{
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }>;
        }>(path.join("assets", "testing-manifest.json"));
        const contracts = readJson<{
            contracts?: Array<{
                authMode?: string;
                manifestId?: string;
                routeMetadata?: {
                    responses?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }>;
        }>(path.join("test", "generated", "http-contracts.json"));

        const entry = catalog.find((route) => route.method === "GET" && route.route === "/content-inventory/users/@me/similar-games/{application_id}");
        assert.deepEqual(entry, {
            method: "GET",
            response_schema_refs: ["APIErrorResponse", "ContentInventorySimilarGamesResponse"],
            route: "/content-inventory/users/@me/similar-games/{application_id}",
            route_name: "GET_CONTENT_INVENTORY_USERS__ME_SIMILAR_GAMES_APPLICATION_ID",
            source: sourceRoutePath,
        });

        assert.equal(
            missingRoutes.missing_entries?.some((route) => route.method === "GET" && route.route === "/content-inventory/users/@me/similar-games/{param}"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((route) => route.method === "GET" && route.route === "/content-inventory/users/@me?refresh_token={param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((route) => route.method === "PATCH" && route.route === "/content-inventory/users/@me/applications/{param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((route) => route.method === "POST" && route.route === "/content-inventory/users/@me/spotify"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((route) => route.method === "DELETE" && route.route === "/content-inventory/users/@me/outbox/entries/id/{param}/history"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, sourceRoutePath);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "ContentInventorySimilarGamesResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401],
        );

        const contractEntry = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contractEntry?.authMode, "bearer");
        assert.equal(contractEntry?.sourceFile, sourceRoutePath);
        assert.deepEqual(contractEntry?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "ContentInventorySimilarGamesResponse"]);
        assert.deepEqual(
            contractEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401],
        );
    });

    test("documents bearer security and the response schema in OpenAPI", () => {
        const openApi = readJson<{
            paths: Record<
                string,
                {
                    get?: {
                        security?: Array<Record<string, unknown[]>>;
                        responses?: Record<
                            string,
                            {
                                content?: {
                                    "application/json"?: {
                                        schema?: {
                                            $ref?: string;
                                        };
                                    };
                                };
                            }
                        >;
                    };
                }
            >;
            components: {
                schemas: Record<string, { items?: unknown; type?: string }>;
            };
        }>(path.join("assets", "openapi.json"));

        const operation = openApi.paths["/content-inventory/users/@me/similar-games/{application_id}/"]?.get;

        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ContentInventorySimilarGamesResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openApi.components.schemas.ContentInventorySimilarGamesResponse.type, "array");
    });
});

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf-8")) as T;
}

async function listen(app: express.Express) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    const address = server.address();
    assert(address && typeof address === "object");

    return {
        server,
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    };
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
