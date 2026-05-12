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
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import type { UserGuildScheduledEventsDependencies } from "./scheduled-events";

const requireModule = require;
const routeModulePath = require.resolve("./scheduled-events");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /users/@me/scheduled-events", () => {
    test("declares authenticated user scheduled-events metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Get User Guild Scheduled Events",
            description:
                "Returns the current user's guild scheduled-event subscriptions for the requested guild IDs. Spacebar does not currently persist scheduled-event subscriptions, so the local representation is empty until that backing state exists.",
            query: {
                guild_ids: {
                    type: "array",
                    required: true,
                    description: "Guild IDs to get subscribed scheduled events for.",
                },
            },
            responses: {
                200: {
                    body: "GuildScheduledEventUsersResponse",
                },
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("parses documented guild_ids filters as unique snowflakes", () => {
        const { parseUserGuildScheduledEventsQuery } = loadRouteModule();

        assert.deepEqual(parseUserGuildScheduledEventsQuery({ guild_ids: ["100000000000000001,100000000000000002", "100000000000000001"] }).guildIds, [
            "100000000000000001",
            "100000000000000002",
        ]);
        assert.deepEqual(parseUserGuildScheduledEventsQuery({ "guild_ids[]": ["100000000000000003", "100000000000000004"] }).guildIds, [
            "100000000000000003",
            "100000000000000004",
        ]);
    });

    test("rejects missing or malformed guild_ids filters", async (t) => {
        const { parseUserGuildScheduledEventsQuery } = loadRouteModule();
        type UserGuildScheduledEventsQuery = Parameters<typeof parseUserGuildScheduledEventsQuery>[0];
        const assertInvalidQuery = (query: UserGuildScheduledEventsQuery) => {
            assert.throws(
                () => parseUserGuildScheduledEventsQuery(query),
                (error) => {
                    assert.equal((error as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
                    return true;
                },
            );
        };

        assertInvalidQuery({});
        assertInvalidQuery({ guild_ids: "not-a-snowflake" });

        const harness = setupUserGuildScheduledEventsRoute(t);
        const response = await requestJson(harness.app, "/users/@me/scheduled-events?guild_ids=not-a-snowflake");

        assert.equal(response.status, 400);
        assert.equal((response.body as { code?: unknown }).code, DiscordApiErrors.INVALID_FORM_BODY.code);
        assert.deepEqual(harness.calls, []);
    });

    test("returns the documented empty local representation for authenticated users", async (t) => {
        const harness = setupUserGuildScheduledEventsRoute(t);

        const response = await requestJson(harness.app, "/users/@me/scheduled-events?guild_ids=100000000000000001,100000000000000002&guild_ids[]=100000000000000001");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.calls, [
            {
                userId: "viewer",
                options: {
                    guildIds: ["100000000000000001", "100000000000000002"],
                },
            },
        ]);
    });

    test("generated artifacts own only the source-backed current-user scheduled-events route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "scheduled-events.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    items?: { $ref?: string };
                    properties?: Record<string, { type?: string | string[]; $ref?: string }>;
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    get?: {
                        parameters?: { name?: string; in?: string; required?: boolean; schema?: { type?: string } }[];
                        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                        security?: unknown;
                    };
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
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
                    hasQuery?: boolean;
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string }[] }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { testFiles?: string[]; manifestIds?: string[] }[] }[] }>(path.join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.match(routeSource, /body:\s*"GuildScheduledEventUsersResponse"/);
        assert.match(routeSource, /guild_ids/);

        assert.equal(schemas.GuildScheduledEventUsersResponse?.type, "array");
        assert.equal(schemas.GuildScheduledEventUsersResponse?.items?.$ref, "#/definitions/GuildScheduledEventUserResponse");
        assert.equal(schemas.GuildScheduledEventUserResponse?.properties?.guild_scheduled_event_id?.type, "string");
        assert.equal(schemas.GuildScheduledEventUserResponse?.properties?.response?.$ref, "#/definitions/GuildScheduledEventUserResponseType");

        const openapiRoute = openapi.paths?.["/users/@me/scheduled-events/"]?.get;
        assert.equal(openapiRoute?.parameters?.find((parameter) => parameter.name === "guild_ids")?.required, true);
        assert.equal(openapiRoute?.parameters?.find((parameter) => parameter.name === "guild_ids")?.schema?.type, "array");
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildScheduledEventUsersResponse");
        assert.equal(openapiRoute?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/scheduled-events");
        assert.equal(sourceRoute?.route_name, "GET_USERS__ME_SCHEDULED_EVENTS");
        assert.equal(sourceRoute?.source, "src/api/routes/users/@me/scheduled-events.ts");
        assert.equal(sourceRoute?.response_schema_refs?.includes("GuildScheduledEventUsersResponse"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/users/@me/scheduled-events"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/scheduled-events/{param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === "/guilds/{param}/scheduled-events/{param}/users/@me"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/users/@me/scheduled-events/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/scheduled-events.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildScheduledEventUsersResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401]);
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === "api:http:GET:/users/@me/scheduled-events/"),
            true,
        );
        assert.equal(
            suiteCoverage.groups?.some((group) => group.suites?.some((suite) => suite.manifestIds?.includes("api:http:GET:/users/@me/scheduled-events/"))),
            true,
        );
    });
});

function loadRouteModule(): typeof import("./scheduled-events") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./scheduled-events");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: unknown, _res: unknown, next: () => void) => next();
    });

    loadRouteModule();

    return routeOptions;
}

type DependencyCall = {
    userId: string;
    options: { guildIds: string[] };
};

function setupUserGuildScheduledEventsRoute(t: TestContext, options: { userId?: string } = {}) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const routeOptions: unknown[] = [];
    const calls: DependencyCall[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    const dependencies: UserGuildScheduledEventsDependencies = {
        listUserGuildScheduledEventUsers: async (userId, listOptions) => {
            calls.push({ userId, options: listOptions });
            return [];
        },
    };

    const router = loadRouteModule().createUserGuildScheduledEventsRouter(dependencies);
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/users/@me/scheduled-events", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get calls() {
            return calls;
        },
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
        server.close();
    }
}

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as T;
}
