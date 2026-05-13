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
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import { HTTPError } from "lambert-server";
import guildGameServerWakeRouter, {
    GUILD_GAME_SERVER_WAKE_UNSUPPORTED_MESSAGE,
    createGuildGameServerWakeRouter,
    createGuildGameServerWakeUnsupportedError,
    wakeGuildGameServer,
    type GuildGameServerWakeDependencies,
} from "../../src/api/routes/guilds/#guild_id/game-servers/#game_server_id/wake";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const coveredManifestId = "api:http:POST:/guilds/:guild_id/game-servers/:game_server_id/wake/";

describe("POST /guilds/:guild_id/game-servers/:game_server_id/wake", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:POST:/guilds/:guild_id/game-servers/:game_server_id/wake/");
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("POST", "/guilds/100000000000000001/game-servers/200000000000000002/wake"), false);
        assert.equal(isNoAuthorizationRoute("POST", "/api/v9/guilds/100000000000000001/game-servers/200000000000000002/wake"), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/game-servers/:game_server_id/wake", guildGameServerWakeRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/guilds/100000000000000001/game-servers/200000000000000002/wake", "POST");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("checks guild existence and member access before failing closed", async (t) => {
        const guildLookups: unknown[] = [];
        const membershipChecks: unknown[][] = [];
        const app = createAuthenticatedRouteApp({
            guildRepository: {
                findOneOrFail: t.mock.fn(async (findOptions: unknown) => {
                    guildLookups.push(findOptions);
                    return { id: "100000000000000001" };
                }),
            },
            assertGuildMember: t.mock.fn(async (...args: [string, string]) => {
                membershipChecks.push(args);
            }),
        });

        const response = await requestJson(app, "/guilds/100000000000000001/game-servers/200000000000000002/wake", "POST");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: GUILD_GAME_SERVER_WAKE_UNSUPPORTED_MESSAGE,
        });
        assert.deepEqual(guildLookups, [
            {
                where: { id: "100000000000000001" },
                select: { id: true },
            },
        ]);
        assert.deepEqual(membershipChecks, [["viewer", "100000000000000001"]]);
    });

    test("returns 404 for unknown guilds before checking membership", async (t) => {
        const membershipChecks: unknown[][] = [];
        const app = createAuthenticatedRouteApp({
            guildRepository: {
                findOneOrFail: t.mock.fn(async () => {
                    throw new HTTPError("Unknown Guild", 404);
                }),
            },
            assertGuildMember: t.mock.fn(async (...args: [string, string]) => {
                membershipChecks.push(args);
            }),
        });

        const response = await requestJson(app, "/guilds/unknown-guild/game-servers/200000000000000002/wake", "POST");

        assert.equal(response.status, 404);
        assert.equal((response.body as { code?: unknown }).code, 404);
        assert.deepEqual(membershipChecks, []);
    });

    test("returns 403 when the authenticated user is not a guild member", async (t) => {
        const app = createAuthenticatedRouteApp({
            guildRepository: {
                findOneOrFail: t.mock.fn(async () => ({ id: "100000000000000001" })),
            },
            assertGuildMember: t.mock.fn(async () => {
                throw new HTTPError("Missing Access", 403);
            }),
        });

        const response = await requestJson(app, "/guilds/100000000000000001/game-servers/200000000000000002/wake", "POST");

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 403);
    });

    test("uses an explicit unsupported-provider API error after access checks", async (t) => {
        const error = createGuildGameServerWakeUnsupportedError();

        assert.equal(error.code, 0);
        assert.equal(error.httpStatus, 501);
        assert.equal(error.message, GUILD_GAME_SERVER_WAKE_UNSUPPORTED_MESSAGE);

        await assert.rejects(
            () =>
                wakeGuildGameServer("viewer", "100000000000000001", "200000000000000002", {
                    guildRepository: {
                        findOneOrFail: t.mock.fn(async () => ({ id: "100000000000000001" })),
                    },
                    assertGuildMember: t.mock.fn(async () => undefined),
                }),
            {
                code: 0,
                httpStatus: 501,
                message: GUILD_GAME_SERVER_WAKE_UNSUPPORTED_MESSAGE,
            },
        );
    });

    test("declares source-backed route metadata in source and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "game-servers", "#game_server_id", "wake.ts"), "utf8");
        const openapi = readJson<OpenApi>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /summary:\s*"Wake Guild Game Server"/);
        assert.match(routeSource, /provider-backed game-server state/);
        assert.match(routeSource, /fails closed with 501/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /permission:\s*"MANAGE_GUILD"/);
        assert.doesNotMatch(routeSource, /game-server-regions/);
        assert.doesNotMatch(routeSource, /200:\s*\{/);

        const route = openapi.paths?.["/guilds/{guild_id}/game-servers/{game_server_id}/wake/"]?.post;
        assert.equal(route?.summary, "Wake Guild Game Server");
        assert.equal(route?.["x-permission-required"], undefined);
        assert.equal(route?.responses?.["200"], undefined);
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/game-servers/#game_server_id/wake.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, undefined);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [401, 403, 404, 501],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "POST" && entry.route === "/guilds/{guild_id}/game-servers/{game_server_id}/wake");
        assert.equal(catalogEntry?.route_name, "POST_GUILDS_GUILD_ID_GAME_SERVERS_GAME_SERVER_ID_WAKE");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/game-servers/#game_server_id/wake.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["APIErrorResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.permission, undefined);
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [401, 403, 404, 501],
        );

        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/guilds/{param}/game-servers/{param}/wake"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/game-servers"),
            true,
        );
    });
});

function createAuthenticatedRouteApp(dependencies: GuildGameServerWakeDependencies) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/game-servers/:game_server_id/wake", createGuildGameServerWakeRouter(dependencies));
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string, method = "GET"): Promise<{ status: number; body: unknown }> {
    const response = await requestText(app, requestPath, method);

    return {
        status: response.status,
        body: JSON.parse(response.body),
    };
}

async function requestText(app: express.Express, requestPath: string, method = "GET"): Promise<{ status: number; body: string }> {
    const server = await listen(app);
    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`, { method });

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        await close(server);
    }
}

async function listen(app: express.Express): Promise<Server> {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.once("listening", () => resolve());
    });

    return server;
}

async function close(server: Server) {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

function readJson<T>(filename: string): T {
    return JSON.parse(readFileSync(filename, "utf8")) as T;
}

type OpenApi = {
    paths?: Record<
        string,
        {
            post?: {
                summary?: string;
                "x-permission-required"?: string;
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
            };
        }
    >;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        sourceFile?: string;
        routeMetadata?: {
            permission?: string;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SourceCatalogEntry = {
    method?: string;
    route?: string;
    route_name?: string;
    source?: string;
    response_schema_refs?: string[];
};

type MissingRoutesReport = {
    missing_entries: {
        method?: string;
        route?: string;
    }[];
};

type HttpContractCatalog = {
    contracts?: {
        manifestId?: string;
        authMode?: string;
        routeMetadata?: {
            permission?: string;
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};
