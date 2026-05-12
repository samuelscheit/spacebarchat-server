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
import { describe, test, type TestContext } from "node:test";
import express from "express";
import { ConnectedAccount, DiscordApiErrors } from "@spacebar/util";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import redditSubredditsRouter, {
    REDDIT_CONNECTION_TYPE,
    getRedditConnectionSubreddits,
    listStoredRedditConnectionSubreddits,
} from "../../src/api/routes/users/@me/connections/reddit/#connection_id/subreddits";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestIds = ["api:http:GET:/users/@me/connections/reddit/:connection_id/subreddits/"];
const assignedSourcePath = "/users/@me/connections/reddit/{param}/subreddits";
const assignedRouteName = "GET_USERS__ME_CONNECTIONS_REDDIT_CONNECTION_ID_SUBREDDITS";

type TestAccount = {
    external_id: string;
    revoked: boolean;
};

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
};

describe("GET /users/@me/connections/reddit/:connection_id/subreddits", () => {
    test("declares the assigned manifest id and stays behind bearer auth", async () => {
        assert.deepEqual(coveredManifestIds, ["api:http:GET:/users/@me/connections/reddit/:connection_id/subreddits/"]);
        assert.equal(assignedSourcePath, "/users/@me/connections/reddit/{param}/subreddits");
        assert.equal(assignedRouteName, "GET_USERS__ME_CONNECTIONS_REDDIT_CONNECTION_ID_SUBREDDITS");
        assert.equal(isNoAuthorizationRoute("GET", "/api/v10/users/@me/connections/reddit/reddit-id/subreddits"), false);
        assert.equal(isNoAuthorizationRoute("HEAD", "/api/v10/users/@me/connections/reddit/reddit-id/subreddits/"), false);

        const response = await requestJson(createAuthenticatedApp(), "/users/@me/connections/reddit/reddit-id/subreddits");

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("queries only the caller's matching Reddit connection", async (t) => {
        const harness = setupRedditSubredditsRoute(t, {
            userId: "viewer",
            account: { external_id: "reddit-id", revoked: false },
        });

        const response = await requestJson(harness.app, "/users/@me/connections/reddit/reddit-id/subreddits");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.connectedAccountFindOptions[0], {
            where: {
                user_id: "viewer",
                external_id: "reddit-id",
                type: REDDIT_CONNECTION_TYPE,
            },
            select: {
                external_id: true,
                revoked: true,
            },
        });
    });

    test("does not fabricate subreddit memberships from Reddit identity metadata", async (t) => {
        const account = { external_id: "reddit-id", revoked: false };
        const harness = setupRedditSubredditsRoute(t, { account });

        assert.deepEqual(listStoredRedditConnectionSubreddits(account), []);
        assert.notEqual(listStoredRedditConnectionSubreddits(account), listStoredRedditConnectionSubreddits(account));

        const response = await requestJson(harness.app, "/users/@me/connections/reddit/reddit-id/subreddits");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
    });

    test("returns Unknown Connection when no active local Reddit connection exists", async (t) => {
        const harness = setupRedditSubredditsRoute(t, { account: null });

        const response = await requestJson(harness.app, "/users/@me/connections/reddit/missing-id/subreddits");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_CONNECTION.code,
            message: DiscordApiErrors.UNKNOWN_CONNECTION.message,
        });
    });

    test("returns Connection Revoked for revoked linked Reddit accounts", async (t) => {
        const harness = setupRedditSubredditsRoute(t, { account: { external_id: "reddit-id", revoked: true } });

        const response = await requestJson(harness.app, "/users/@me/connections/reddit/reddit-id/subreddits");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.CONNECTION_REVOKED.code,
            message: DiscordApiErrors.CONNECTION_REVOKED.message,
        });
    });

    test("uses shared Discord API errors for missing and revoked accounts", async (t) => {
        setupRedditSubredditsRoute(t, { account: null });
        await assert.rejects(getRedditConnectionSubreddits("viewer", "missing-id"), {
            code: DiscordApiErrors.UNKNOWN_CONNECTION.code,
        });

        t.mock.restoreAll();
        setupRedditSubredditsRoute(t, { account: { external_id: "reddit-id", revoked: true } });
        await assert.rejects(getRedditConnectionSubreddits("viewer", "reddit-id"), {
            code: DiscordApiErrors.CONNECTION_REVOKED.code,
        });
    });

    test("generates response schema, route catalogs, manifest metadata, and missing-route removal", () => {
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
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                    hasQuery?: boolean;
                };
            }[];
        };
        const sourceCatalog = JSON.parse(
            readFileSync(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"), "utf8"),
        ) as {
            method?: string;
            route?: string;
            route_name?: string;
            source?: string;
            response_schema_refs?: string[];
        }[];
        const missingRoutes = JSON.parse(readFileSync(join(process.cwd(), "packages", "missing-routes", "missing.json"), "utf8")) as {
            missing_entries?: { method?: string; route?: string }[];
        };

        assert.equal(schemas.ConnectedAccountSubredditsResponse.type, "array");
        assert.equal(schemas.ConnectedAccountSubredditsResponse.items?.$ref, "#/definitions/ConnectedAccountSubredditResponse");
        assert.deepEqual(schemas.ConnectedAccountSubredditResponse.required, ["id", "subscribers", "url"]);
        assert.equal(schemas.ConnectedAccountSubredditResponse.properties?.subscribers?.type, "integer");

        const route = openapi.paths?.["/users/@me/connections/reddit/{connection_id}/subreddits/"]?.get;
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/ConnectedAccountSubredditsResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestIds[0]);
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/connections/reddit/#connection_id/subreddits.ts");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, false);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("ConnectedAccountSubredditsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(200), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(400), true);
        assert.equal(manifestEntry?.routeMetadata?.responseStatuses?.includes(401), true);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/connections/reddit/{connection_id}/subreddits");
        assert.equal(catalogEntry?.source, "src/api/routes/users/@me/connections/reddit/#connection_id/subreddits.ts");
        assert.equal(catalogEntry?.route_name, "GET_USERS__ME_CONNECTIONS_REDDIT_CONNECTION_ID_SUBREDDITS");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["APIErrorResponse", "ConnectedAccountSubredditsResponse"]);
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/connections/reddit/{param}/subreddits"),
            false,
        );
    });
});

function setupRedditSubredditsRoute(t: TestContext, options: { account: TestAccount | null; userId?: string }) {
    const connectedAccountFindOptions: unknown[] = [];

    t.mock.method(ConnectedAccount, "findOne", async (findOptions: unknown) => {
        connectedAccountFindOptions.push(findOptions);
        return options.account as never;
    });

    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/users/@me/connections/reddit/:connection_id/subreddits", redditSubredditsRouter);
    app.use(ErrorHandler);

    return {
        app,
        get connectedAccountFindOptions() {
            return connectedAccountFindOptions;
        },
    };
}

function createAuthenticatedApp() {
    const app = express();

    app.use(Authentication);
    app.use("/users/@me/connections/reddit/:connection_id/subreddits", redditSubredditsRouter);
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = await new Promise<ReturnType<express.Express["listen"]>>((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`);

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
