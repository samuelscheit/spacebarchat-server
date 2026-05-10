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
import suggestedGamesRouter, { buildProfileWidgetsSuggestedGamesResponse } from "../../src/api/routes/users/@me/widgets/suggested-games";

describe("GET /users/@me/widgets/suggested-games", () => {
    test("returns the current conservative empty suggestion sets", async () => {
        const first = buildProfileWidgetsSuggestedGamesResponse("user-id");
        const second = buildProfileWidgetsSuggestedGamesResponse("user-id");

        first.suggested_games.push("100000000000000001");

        assert.deepEqual(second, {
            suggested_games: [],
            suggested_wishlist_games: [],
        });

        const app = express();
        app.use((req, _res, next) => {
            req.user_id = "user-id";
            next();
        });
        app.use("/users/@me/widgets/suggested-games", suggestedGamesRouter);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/users/@me/widgets/suggested-games`);

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), {
                suggested_games: [],
                suggested_wishlist_games: [],
            });
        } finally {
            await close(server);
        }
    });

    test("stays on the authenticated route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/widgets/suggested-games"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/widgets/suggested-games"), false);
    });

    test("is present in the regenerated source route catalog with success and auth error schemas", () => {
        const catalogPath = path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json");
        const catalog = JSON.parse(readFileSync(catalogPath, "utf-8")) as Array<{
            method: string;
            route: string;
            route_name: string;
            source: string;
            response_schema_refs?: string[];
        }>;

        const entry = catalog.find((route) => route.method === "GET" && route.route === "/users/@me/widgets/suggested-games");

        assert.deepEqual(entry, {
            method: "GET",
            response_schema_refs: ["APIErrorResponse", "ProfileWidgetsSuggestedGamesResponse"],
            route: "/users/@me/widgets/suggested-games",
            route_name: "GET_USERS__ME_WIDGETS_SUGGESTED_GAMES",
            source: "src/api/routes/users/@me/widgets/suggested-games.ts",
        });

        const missingPath = path.join(process.cwd(), "packages", "missing-routes", "missing.json");
        const missing = JSON.parse(readFileSync(missingPath, "utf-8")) as {
            missing_entries: Array<{
                method: string;
                route: string;
            }>;
        };

        assert.equal(
            missing.missing_entries.some((route) => route.method === "GET" && route.route === "/users/@me/widgets/suggested-games"),
            false,
        );
    });

    test("documents bearer security and profile widget suggested game response in OpenAPI", () => {
        const openApiPath = path.join(process.cwd(), "assets", "openapi.json");
        const openApi = JSON.parse(readFileSync(openApiPath, "utf-8")) as {
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
                schemas: Record<string, { required?: string[] }>;
            };
        };

        const operation = openApi.paths["/users/@me/widgets/suggested-games/"]?.get;

        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ProfileWidgetsSuggestedGamesResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openApi.components.schemas.ProfileWidgetsSuggestedGamesResponse.required?.sort(), ["suggested_games", "suggested_wishlist_games"]);

        const manifestPath = path.join(process.cwd(), "assets", "testing-manifest.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
            entries?: Array<{
                id?: string;
                authMode?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }>;
        };

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/users/@me/widgets/suggested-games/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "ProfileWidgetsSuggestedGamesResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401],
        );
    });
});

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
