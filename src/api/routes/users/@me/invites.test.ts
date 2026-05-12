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
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import type { UserInvitesResponse } from "@spacebar/schemas";
import express from "express";
import { isNoAuthorizationRoute } from "../../../middlewares/NoAuthorizationRoutes";
import type { UserInvitesRouteDependencies } from "./invites";

const requireModule = require;
const routeModulePath = require.resolve("./invites");

const manifestId = "api:http:GET:/users/@me/invites/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/@me/invites", () => {
    test("declares authenticated friend-invite metadata without changing create metadata", (t) => {
        const harness = setupUserInvitesRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get User Invites",
            responses: {
                200: {
                    body: "UserInvitesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
        assert.deepEqual(harness.routeOptions[1], {
            requestBody: "UserInviteCreateSchema",
            right: "INVITE_USERS",
            responses: {
                201: {
                    body: "UserInviteResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays on the authenticated route boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/invites"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/invites"), false);
    });

    test("returns active friend invites for the authenticated user", async (t) => {
        const inviteCreatedAt = new Date("2026-05-05T10:00:00.000Z");
        const inviteExpiresAt = new Date("2026-05-12T10:00:00.000Z");
        const responseBody: UserInvitesResponse = [
            {
                type: 2,
                code: "friend1",
                temporary: false,
                uses: 1,
                max_uses: 5,
                max_age: 604800,
                created_at: inviteCreatedAt,
                expires_at: inviteExpiresAt,
                inviter_id: "viewer",
                inviter: {
                    id: "viewer",
                    username: "viewer",
                    discriminator: "0001",
                    public_flags: 0,
                    bio: "",
                    bot: false,
                    premium_since: null,
                    premium_type: 0,
                },
                flags: 0,
            },
        ];
        const harness = setupUserInvitesRoute(t, {
            listUserInvites: async (userId) => {
                harness.calls.push(userId);
                return responseBody;
            },
        });

        const response = await requestJson(harness.app, "/users/@me/invites");

        assert.equal(response.status, 200);
        assert.deepEqual(harness.calls, ["viewer"]);
        assert.deepEqual(response.body, [
            {
                ...responseBody[0],
                created_at: inviteCreatedAt.toISOString(),
                expires_at: inviteExpiresAt.toISOString(),
            },
        ]);
    });

    test("generated artifacts own only GET and existing POST for user invite path", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "invites.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    items?: { $ref?: string };
                    properties?: Record<string, { const?: number; type?: string }>;
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    post?: {
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                    delete?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string }[] }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { testFiles?: string[]; manifestIds?: string[] }[] }[] }>(path.join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.match(routeSource, /body:\s*"UserInvitesResponse"/);
        assert.match(routeSource, /router\.post\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.delete\(/);

        assert.equal(schemas.UserInvitesResponse?.type, "array");
        assert.equal(schemas.UserInvitesResponse?.items?.$ref, "#/definitions/UserInviteResponse");
        assert.equal(schemas.UserInviteResponse?.properties?.type?.const, 2);

        const route = openapi.paths?.["/users/@me/invites/"];
        assert.equal(route?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserInvitesResponse");
        assert.equal(route?.get?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.get?.security, [{ bearer: [] }]);
        assert.equal(route?.post?.responses?.["201"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserInviteResponse");
        assert.equal(route?.delete, undefined);

        const getSourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/invites");
        assert.equal(getSourceRoute?.route_name, "GET_USERS__ME_INVITES");
        assert.equal(getSourceRoute?.source, "src/api/routes/users/@me/invites.ts");
        assert.equal(getSourceRoute?.response_schema_refs?.includes("UserInvitesResponse"), true);
        assert.equal(getSourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        const postSourceRoute = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/users/@me/invites");
        assert.equal(postSourceRoute?.request_schema_ref, "UserInviteCreateSchema");
        assert.equal(postSourceRoute?.response_schema_refs?.includes("UserInviteResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/invites"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "DELETE" && entry.route === "/users/@me/invites"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/invites.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("UserInvitesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401]);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === manifestId),
            true,
        );
        const coverageSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.manifestIds?.includes(manifestId));
        assert.equal(coverageSuite?.testFiles?.includes("src/api/util/utility/UserInvites.test.ts"), true);
    });
});

type TestHarness = {
    app: express.Express;
    calls: string[];
    routeOptions: unknown[];
};

function setupUserInvitesRoute(t: TestContext, dependencies: UserInvitesRouteDependencies = {}): TestHarness {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const routeOptions: unknown[] = [];
    const calls: string[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./invites");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use(
        "/users/@me/invites",
        routeModule.createUserInvitesRouter({
            createUserInvite: dependencies.createUserInvite,
            listUserInvites: dependencies.listUserInvites ?? (async () => []),
        }),
    );

    return {
        app,
        calls,
        get routeOptions() {
            return routeOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

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

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as T;
}
