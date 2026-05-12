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
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import express from "express";
import { createGuildJoinRequestsRouter, getCurrentUserGuildJoinRequest, type GuildJoinRequestsRepositories } from "../../src/api/routes/guilds/#guild_id/requests";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const requestsRouter = createGuildJoinRequestsRouter();
const coveredManifestId = "api:http:GET:/guilds/:guild_id/requests/@me";

describe("GET /guilds/:guild_id/requests/@me", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/requests/@me");
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/guilds/100000000000000001/requests/@me"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/guilds/100000000000000001/requests/@me"), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/requests", requestsRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/guilds/100000000000000001/requests/@me");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("checks guild existence and returns 204 when no current-user join request is persisted", async () => {
        const guildLookups: unknown[] = [];
        const repositories = createRepositories({ guildLookups });

        assert.equal(await getCurrentUserGuildJoinRequest("100000000000000001", "viewer", repositories), null);
        assert.deepEqual(guildLookups, [
            {
                where: { id: "100000000000000001" },
                select: { id: true },
            },
        ]);

        guildLookups.length = 0;
        const app = createAuthenticatedRouteApp(repositories);
        const response = await requestText(app, "/guilds/100000000000000001/requests/@me");

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(guildLookups, [
            {
                where: { id: "100000000000000001" },
                select: { id: true },
            },
        ]);
    });

    test("uses the existing not-found behavior when the guild does not exist", async () => {
        const { EntityNotFoundError } = await import("typeorm");
        const findOptions = {
            where: { id: "missing-guild" },
            select: { id: true },
        };
        const repositories = {
            guildRepository: {
                findOneOrFail: async () => {
                    throw new EntityNotFoundError("Guild", findOptions.where);
                },
            },
        };

        await assert.rejects(() => getCurrentUserGuildJoinRequest("missing-guild", "viewer", repositories), {
            name: "EntityNotFoundError",
        });
    });

    test("declares source-backed route metadata in source and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "requests.ts"), "utf8");
        const currentUserSegment = routeSource.slice(routeSource.indexOf('router.get(\n        "/@me"'), routeSource.indexOf('router.get(\n        "/@me/cooldown"'));
        const openapi = readJson<OpenApi>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const userdoccersCatalog = readJson<SourceCatalogEntry[]>(
            join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.userdoccers.catalog.json"),
        );
        const xhyromCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.xhyrom.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.match(currentUserSegment, /summary:\s*"Get Current User Guild Join Request"/);
        assert.match(currentUserSegment, /durable current-user guild join request store/);
        assert.doesNotMatch(currentUserSegment, /permission:\s*"MANAGE_GUILD"/);
        assert.doesNotMatch(currentUserSegment, /router\.(?:post|put|patch|delete)\(/);
        assert.doesNotMatch(currentUserSegment, /requests\/@me\/cooldown|join-requests|member-verification|new-member-action|onboarding/);
        assert.match(currentUserSegment, /204:\s*\{\s*\}/s);
        assert.match(currentUserSegment, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(currentUserSegment, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        const route = openapi.paths?.["/guilds/{guild_id}/requests/@me"]?.get;
        assert.equal(route?.summary, "Get Current User Guild Join Request");
        assert.equal(route?.["x-permission-required"], undefined);
        assert.ok(route?.responses?.["204"], "204 response should be documented for absent local current-user join request state");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/requests.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, undefined);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [204, 401, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/requests/@me");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_REQUESTS__ME");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/requests.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse"]);

        const userdoccersEntry = userdoccersCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/requests/@me");
        assert.equal(userdoccersEntry?.source, "userdoccers:resources/guild.mdx");
        assert.equal(userdoccersEntry?.summary, "Get Current User Guild Join Request");
        const xhyromEntry = xhyromCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/requests/@me");
        assert.equal(xhyromEntry?.route_name, "GUILD_MEMBER_REQUEST_TO_JOIN");

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.permission, undefined);
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [204, 401, 404],
        );

        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);
        assert.equal(hasMissingRoute(missingRoutes, "GET", "/guilds/{param}/requests/@me"), false);
        assert.equal(hasMissingRoute(missingRoutes, "GET", "/guilds/{param}/requests/@me/cooldown"), false);
        assert.equal(hasMissingRoute(missingRoutes, "PATCH", "/guilds/{param}/requests/@me"), true);
        assert.equal(hasMissingRoute(missingRoutes, "POST", "/guilds/{param}/requests/@me"), true);
        assert.equal(hasMissingRoute(missingRoutes, "PUT", "/guilds/{param}/requests/@me"), true);
        assert.equal(hasMissingRoute(missingRoutes, "DELETE", "/guilds/{param}/requests/@me"), true);
        assert.equal(hasMissingRoute(missingRoutes, "GET", "/guilds/{param}/requests"), false);
        assert.equal(hasMissingRoute(missingRoutes, "GET", "/join-requests/{param}"), true);
    });
});

function createRepositories({
    guildLookups = [],
}: {
    guildLookups?: unknown[];
} = {}): GuildJoinRequestsRepositories {
    return {
        guildRepository: {
            findOneOrFail: async (findOptions: unknown) => {
                guildLookups.push(findOptions);
                return { id: "100000000000000001" };
            },
        },
    };
}

function createAuthenticatedRouteApp(repositories: GuildJoinRequestsRepositories) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/requests", createGuildJoinRequestsRouter(repositories));
    app.use(ErrorHandler);

    return app;
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const response = await requestText(app, requestPath);

    return {
        status: response.status,
        body: JSON.parse(response.body),
    };
}

async function requestText(app: express.Express, requestPath: string): Promise<{ status: number; body: string }> {
    const server = await listen(app);
    try {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
        const response = await fetch(`http://127.0.0.1:${(address as AddressInfo).port}${requestPath}`);

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

function hasMissingRoute(report: MissingRoutesReport, method: string, route: string): boolean {
    return report.missing_entries.some((entry) => entry.method === method && entry.route === route);
}

type OpenApi = {
    paths?: Record<
        string,
        {
            get?: {
                summary?: string;
                "x-permission-required"?: unknown;
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
    summary?: string;
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
