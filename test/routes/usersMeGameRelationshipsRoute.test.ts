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
import gameRelationshipsRouter from "../../src/api/routes/users/@me/game-relationships";
import { GameRelationshipType } from "../../src/schemas/responses/GameRelationshipsResponse";

describe("GET /users/@me/game-relationships", () => {
    test("returns the current conservative empty game relationship collection", async () => {
        const app = express();
        app.use("/users/@me/game-relationships", gameRelationshipsRouter);

        const { server, baseUrl } = await listen(app);
        try {
            const response = await fetch(`${baseUrl}/users/@me/game-relationships`);

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), []);
        } finally {
            await close(server);
        }
    });

    test("keeps the documented game relationship type subset", () => {
        const values = Object.values(GameRelationshipType)
            .filter((value): value is number => typeof value === "number")
            .sort((a, b) => a - b);

        assert.deepEqual(values, [1, 3, 4]);
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

        const entry = catalog.find((route) => route.method === "GET" && route.route === "/users/@me/game-relationships");

        assert.deepEqual(entry, {
            method: "GET",
            response_schema_refs: ["APIErrorResponse", "GameRelationshipsResponse"],
            route: "/users/@me/game-relationships",
            route_name: "GET_USERS__ME_GAME_RELATIONSHIPS",
            source: "src/api/routes/users/@me/game-relationships.ts",
        });
    });

    test("documents bearer security and 401 API error response in OpenAPI", () => {
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
        };

        const operation = openApi.paths["/users/@me/game-relationships/"]?.get;

        assert.deepEqual(operation?.security, [{ bearer: [] }]);
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GameRelationshipsResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
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
