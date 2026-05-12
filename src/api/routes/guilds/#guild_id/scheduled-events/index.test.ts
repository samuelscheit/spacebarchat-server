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
import express from "express";
import { HTTPError } from "lambert-server";
import type { GuildScheduledEventsDependencies } from "./index";

const requireModule = require;
const routeModulePath = require.resolve("./index");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/scheduled-events", () => {
    test("declares authenticated guild scheduled-events metadata", (t) => {
        const routeOptions = captureRouteOptions(t);

        assert.deepEqual(routeOptions[0], {
            summary: "Get Guild Scheduled Events",
            description: "Returns scheduled and active guild scheduled events visible to the current guild member.",
            query: {
                with_user_count: {
                    type: "boolean",
                    description: "Whether to include subscriber counts for each scheduled event.",
                },
            },
            responses: {
                200: {
                    body: "GuildScheduledEventsResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("checks guild existence before membership and local scheduled-event lookup", async (t) => {
        const harness = setupGuildScheduledEventsRoute(t, { missingGuild: true });

        const response = await requestJson(harness.app, "/guilds/missing-guild/scheduled-events");

        assert.equal(response.status, 404);
        assert.deepEqual(harness.calls, {
            assertGuildExists: ["missing-guild"],
            assertRequesterGuildMember: [],
            listGuildScheduledEvents: [],
        });
    });

    test("requires the requester to be a guild member before returning the local empty list", async (t) => {
        const harness = setupGuildScheduledEventsRoute(t, { requesterMember: false });

        const response = await requestJson(harness.app, "/guilds/guild-id/scheduled-events");

        assert.equal(response.status, 403);
        assert.deepEqual(harness.calls, {
            assertGuildExists: ["guild-id"],
            assertRequesterGuildMember: [{ userId: "viewer", guildId: "guild-id" }],
            listGuildScheduledEvents: [],
        });
    });

    test("returns the documented empty local representation and parses with_user_count", async (t) => {
        const harness = setupGuildScheduledEventsRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-id/scheduled-events?with_user_count=true");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.calls, {
            assertGuildExists: ["guild-id"],
            assertRequesterGuildMember: [{ userId: "viewer", guildId: "guild-id" }],
            listGuildScheduledEvents: [{ guildId: "guild-id", options: { withUserCount: true } }],
        });
    });

    test("generated artifacts own only the source-backed list scheduled-events route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "scheduled-events", "index.ts"), "utf8");
        const schemas = readJson<Record<string, { type?: string; items?: { $ref?: string } }>>(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<string, { get?: { responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>; security?: unknown } }>;
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
        assert.match(routeSource, /body:\s*"GuildScheduledEventsResponse"/);
        assert.match(routeSource, /with_user_count/);

        assert.equal(schemas.GuildScheduledEventsResponse?.type, "array");
        assert.equal(schemas.GuildScheduledEventsResponse?.items?.$ref, "#/definitions/GuildScheduledEventResponse");

        const openapiRoute = openapi.paths?.["/guilds/{guild_id}/scheduled-events/"]?.get;
        assert.equal(openapiRoute?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildScheduledEventsResponse");
        assert.equal(openapiRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapiRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(openapiRoute?.security, [{ bearer: [] }]);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/scheduled-events");
        assert.equal(sourceRoute?.route_name, "GET_GUILDS_GUILD_ID_SCHEDULED_EVENTS");
        assert.equal(sourceRoute?.source, "src/api/routes/guilds/#guild_id/scheduled-events/index.ts");
        assert.equal(sourceRoute?.response_schema_refs?.includes("GuildScheduledEventsResponse"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/scheduled-events"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "POST" && entry.route === "/guilds/{param}/scheduled-events"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/scheduled-events/{param}"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === "api:http:GET:/guilds/:guild_id/scheduled-events/");
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/scheduled-events/index.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildScheduledEventsResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401, 403, 404]);
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === "api:http:GET:/guilds/:guild_id/scheduled-events/"),
            true,
        );
        assert.equal(
            suiteCoverage.groups?.some((group) => group.suites?.some((suite) => suite.manifestIds?.includes("api:http:GET:/guilds/:guild_id/scheduled-events/"))),
            true,
        );
    });
});

function loadRouteModule(): typeof import("./index") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./index");
}

function captureRouteOptions(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: unknown, _res: unknown, next: () => void) => next();
    });

    loadRouteModule();

    return routeOptions;
}

type SetupOptions = {
    missingGuild?: boolean;
    requesterMember?: boolean;
    userId?: string;
};

type DependencyCalls = {
    assertGuildExists: string[];
    assertRequesterGuildMember: { userId: string | undefined; guildId: string }[];
    listGuildScheduledEvents: { guildId: string; options: { withUserCount: boolean } }[];
};

function setupGuildScheduledEventsRoute(t: TestContext, options: SetupOptions = {}) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../../middlewares/ErrorHandler");
    const routeOptions: unknown[] = [];
    const calls: DependencyCalls = {
        assertGuildExists: [],
        assertRequesterGuildMember: [],
        listGuildScheduledEvents: [],
    };

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    const dependencies: GuildScheduledEventsDependencies = {
        assertGuildExists: async (guildId) => {
            calls.assertGuildExists.push(guildId);
            if (options.missingGuild) throw new HTTPError("Guild could not be found", 404);
        },
        assertRequesterGuildMember: async (userId, guildId) => {
            calls.assertRequesterGuildMember.push({ userId, guildId });
            if (options.requesterMember === false) throw new HTTPError("You are not member of this guild", 403);
        },
        listGuildScheduledEvents: async (guildId, listOptions) => {
            calls.listGuildScheduledEvents.push({ guildId, options: listOptions });
            return [];
        },
    };

    const router = loadRouteModule().createGuildScheduledEventsRouter(dependencies);
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/guilds/:guild_id/scheduled-events", router);
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
