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
import { afterEach, describe, mock, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { Config, User } from "@spacebar/util";
import express from "express";
import router, { createCurrentUserPomeloSuggestion } from "../../src/api/routes/users/@me/pomelo-suggestions";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/users/@me/pomelo-suggestions/"];
const routePath = "/users/@me/pomelo-suggestions";
const sourceFile = "src/api/routes/users/@me/pomelo-suggestions.ts";

type JsonSchema = {
    $ref?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

afterEach(() => {
    mock.restoreAll();
});

describe("GET /users/@me/pomelo-suggestions", () => {
    test("documents the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/pomelo-suggestions/"]);
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/pomelo-suggestions"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/users/@me/pomelo-suggestions/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/pomelo-suggestions");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("returns a source-backed suggestion from the authenticated user's username", async () => {
        mockPomeloConfig();
        const lookups = mockUsernameAvailability(new Set(["gnarp.gnap"]));

        const response = await requestJson(createRouteApp("Gnarp Gnap"), "/users/@me/pomelo-suggestions");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { username: "gnarp.gnap1" });
        assert.deepEqual(lookups, [
            { username: "gnarp.gnap", userId: "viewer" },
            { username: "gnarp.gnap1", userId: "viewer" },
        ]);
    });

    test("uses a conservative default base when the current username is not eligible", async () => {
        mockPomeloConfig();
        const checked: string[] = [];

        const suggestion = await createCurrentUserPomeloSuggestion("Discord Support", "viewer", {
            isAvailable: (candidate) => {
                checked.push(candidate);
                return true;
            },
        });

        assert.equal(suggestion, "user");
        assert.deepEqual(checked, ["user"]);
    });

    test("declares source-backed metadata and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "pomelo-suggestions.ts"), "utf8");
        const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchema>;
        const openapi = JSON.parse(readFileSync(join(process.cwd(), "assets", "openapi.json"), "utf8")) as {
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        };
        const manifest = JSON.parse(readFileSync(join(process.cwd(), "assets", "testing-manifest.json"), "utf8")) as {
            entries?: {
                authMode?: string;
                id?: string;
                path?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
                sourceFile?: string;
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            response_schema_refs?: string[];
            route?: string;
            route_name?: string;
            source?: string;
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string; route_name?: string }[];
        };

        assert.match(routeSource, /summary:\s*"Get Unique Username Suggestions"/);
        assert.match(routeSource, /description:\s*"Returns a suggested unique username string based on the current user's username\."/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"UniqueUsernameSuggestionResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.UniqueUsernameSuggestionResponse.type, "object");
        assert.deepEqual(schemas.UniqueUsernameSuggestionResponse.required, ["username"]);
        assert.equal(schemas.UniqueUsernameSuggestionResponse.properties?.username?.type, "string");

        const route = openapi.paths?.["/users/@me/pomelo-suggestions/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UniqueUsernameSuggestionResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, "/users/@me/pomelo-suggestions/");
        assert.equal(manifestEntry?.sourceFile, sourceFile);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UniqueUsernameSuggestionResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((left, right) => left - right),
            [200, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === routePath);
        assert.equal(catalogEntry?.route_name, "GET_USERS__ME_POMELO_SUGGESTIONS");
        assert.equal(catalogEntry?.source, sourceFile);
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "UniqueUsernameSuggestionResponse"]);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === routePath && entry.route_name === "GET_USERS__ME_POMELO_SUGGESTIONS"),
            false,
        );
    });
});

function mockPomeloConfig() {
    mock.method(
        Config,
        "get",
        () =>
            ({
                limits: {
                    user: {
                        maxUsername: 32,
                    },
                },
                user: {
                    blockedContains: ["discord"],
                    blockedEquals: ["everyone", "here", "system message"],
                },
            }) as ReturnType<typeof Config.get>,
    );
}

function mockUsernameAvailability(taken: Set<string>) {
    const lookups: { username: string; userId: string }[] = [];

    mock.method(User, "createQueryBuilder", () => {
        let username: string | undefined;
        let userId: string | undefined;
        const builder = {
            select(sql: string) {
                assert.equal(sql, "user.id");
                return builder;
            },
            where(sql: string, parameters: { username?: string }) {
                assert.equal(sql, "LOWER(user.username) = :username");
                username = parameters.username;
                return builder;
            },
            andWhere(sql: string, parameters: { userId?: string }) {
                assert.equal(sql, "user.id != :userId");
                userId = parameters.userId;
                if (typeof username !== "string" || typeof userId !== "string") assert.fail("expected username and user id lookup");
                lookups.push({ username, userId });
                return builder;
            },
            async getOne() {
                if (typeof username !== "string") assert.fail("expected username lookup");
                return taken.has(username) ? ({ id: "existing-user" } as User) : null;
            },
        };

        return builder as unknown as ReturnType<typeof User.createQueryBuilder>;
    });

    return lookups;
}

function createRouteApp(username: string) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        req.user = { id: "viewer", username } as User;
        next();
    });
    app.use(routePath, router);
    app.use(ErrorHandler);

    return app;
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use(routePath, router);
    app.use(ErrorHandler);

    return app;
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
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
