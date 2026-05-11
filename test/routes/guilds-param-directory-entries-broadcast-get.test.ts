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
import { join } from "node:path";
import { describe, test, type TestContext } from "node:test";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createGuildDirectoryBroadcastInfoRouter,
    getConservativeBroadcastInfo,
    getGuildDirectoryBroadcastInfoResponse,
    parseGuildDirectoryBroadcastInfoQuery,
    type GuildDirectoryBroadcastInfoDependencies,
} from "../../src/api/routes/guilds/#guild_id/directory-entries/broadcast";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { DiscordApiErrors } from "../../src/util";

const guildId = "200000000000000002";
const viewerId = "100000000000000001";
const entityId = "300000000000000003";
const coveredManifestId = "api:http:GET:/guilds/:guild_id/directory-entries/broadcast/";

describe("GET /guilds/:guild_id/directory-entries/broadcast", () => {
    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/directory-entries/broadcast`), false);

        const response = await requestJson(createAuthenticatedApp(dependencies), `/guilds/${guildId}/directory-entries/broadcast?type=0`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.findGuild).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.getBroadcastInfo).mock.callCount(), 0);
    });

    test("returns conservative broadcast info for authenticated guild members", async (t) => {
        const dependencies = createDependencies(t);

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/directory-entries/broadcast?type=0`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { can_broadcast: false });
        assert.deepEqual(mockOf(dependencies.findGuild).mock.calls[0].arguments[0], {
            where: { id: guildId },
            select: { id: true },
        });
        assert.deepEqual(mockOf(dependencies.isGuildMember).mock.calls[0].arguments, [viewerId, guildId]);
        assert.deepEqual(mockOf(dependencies.getBroadcastInfo).mock.calls[0].arguments, [guildId, viewerId, { type: 0 }]);
    });

    test("includes has_broadcast only when an entity_id is provided", async (t) => {
        const dependencies = createDependencies(t);

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/directory-entries/broadcast?type=1&entity_id=${entityId}`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { can_broadcast: false, has_broadcast: false });
        assert.deepEqual(mockOf(dependencies.getBroadcastInfo).mock.calls[0].arguments, [guildId, viewerId, { type: 1, entity_id: entityId }]);
        assert.deepEqual(getConservativeBroadcastInfo({ type: 1 }), { can_broadcast: false });
        assert.deepEqual(getConservativeBroadcastInfo({ type: 1, entity_id: entityId }), { can_broadcast: false, has_broadcast: false });
    });

    test("returns provider-backed broadcast info after guild and membership checks", async (t) => {
        const dependencies = createDependencies(t, {
            getBroadcastInfo: t.mock.fn(async () => ({ can_broadcast: true, has_broadcast: true })),
        });

        assert.deepEqual(await getGuildDirectoryBroadcastInfoResponse(guildId, viewerId, { type: 0, entity_id: entityId }, dependencies), {
            can_broadcast: true,
            has_broadcast: true,
        });
    });

    test("validates documented query fields", () => {
        assert.deepEqual(parseGuildDirectoryBroadcastInfoQuery({ type: "0" } as never), { type: 0 });
        assert.deepEqual(parseGuildDirectoryBroadcastInfoQuery({ type: "1", entity_id: entityId } as never), { type: 1, entity_id: entityId });

        assertBroadcastFieldError(() => parseGuildDirectoryBroadcastInfoQuery({} as never), "type", "BASE_TYPE_REQUIRED");
        assertBroadcastFieldError(() => parseGuildDirectoryBroadcastInfoQuery({ type: "2" } as never), "type", "BASE_TYPE_CHOICES");
        assertBroadcastFieldError(() => parseGuildDirectoryBroadcastInfoQuery({ type: "0", entity_id: "not-a-snowflake" } as never), "entity_id", "BASE_TYPE_BAD_FORMAT");
    });

    test("returns unknown guild before membership or broadcast lookups", async (t) => {
        const dependencies = createDependencies(t, {
            findGuild: t.mock.fn(async () => null),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/directory-entries/broadcast?type=0`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_GUILD.code,
            message: DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.getBroadcastInfo).mock.callCount(), 0);
    });

    test("returns forbidden for authenticated users outside the guild", async (t) => {
        const dependencies = createDependencies(t, {
            isGuildMember: t.mock.fn(async () => false),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/directory-entries/broadcast?type=0`);

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 403);
        assert.equal(mockOf(dependencies.getBroadcastInfo).mock.callCount(), 0);
    });

    test("declares response schemas, query metadata, and generated route artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "directory-entries", "broadcast.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const contracts = readJson<HttpContractCatalog>(join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<SuiteCoverageCatalog>(join("test", "generated", "suite-coverage.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Get Directory Broadcast Info"/);
        assert.match(routeSource, /type:\s*\{\s*type:\s*"integer",\s*required:\s*true/s);
        assert.match(routeSource, /entity_id:\s*\{\s*type:\s*"string"/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildDirectoryBroadcastInfoResponse"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.GuildDirectoryBroadcastInfoResponse?.type, "object");
        assert.equal(schemas.GuildDirectoryBroadcastInfoResponse?.properties?.can_broadcast?.type, "boolean");
        assert.equal(schemas.GuildDirectoryBroadcastInfoResponse?.properties?.has_broadcast?.type, "boolean");
        assert.deepEqual(schemas.GuildDirectoryBroadcastInfoResponse?.required, ["can_broadcast"]);

        const route = openapi.paths?.["/guilds/{guild_id}/directory-entries/broadcast/"]?.get ?? openapi.paths?.["/guilds/{guild_id}/directory-entries/broadcast"]?.get;
        assert.equal(route?.summary, "Get Directory Broadcast Info");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildDirectoryBroadcastInfoResponse");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.deepEqual(
            route?.parameters?.filter((parameter) => parameter.in === "query").map((parameter) => [parameter.name, parameter.required, parameter.schema?.type]),
            [
                ["type", true, "integer"],
                ["entity_id", undefined, "string"],
            ],
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId || entry.id === coveredManifestId.slice(0, -1));
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/directory-entries/broadcast.ts");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildDirectoryBroadcastInfoResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 400, 401, 403, 404],
        );
        assert.equal(manifestEntry?.routeMetadata?.hasQuery, true);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/directory-entries/broadcast");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_DIRECTORY_ENTRIES_BROADCAST");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/directory-entries/broadcast.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildDirectoryBroadcastInfoResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId || entry.manifestId === coveredManifestId.slice(0, -1));
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.responses?.includes("GuildDirectoryBroadcastInfoResponse"), true);
        assert.equal(contract?.routeMetadata?.responseStatuses?.includes(403), true);
        assert.equal(contract?.contractChecks?.includes("authenticated"), true);

        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/directory-entries/broadcast"),
            false,
        );
    });
});

function createApp(dependencies: GuildDirectoryBroadcastInfoDependencies) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = viewerId;
        next();
    });
    app.use("/guilds/:guild_id/directory-entries/broadcast", createGuildDirectoryBroadcastInfoRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp(dependencies: GuildDirectoryBroadcastInfoDependencies) {
    const app = express();
    app.use(Authentication);
    app.use("/guilds/:guild_id/directory-entries/broadcast", createGuildDirectoryBroadcastInfoRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createThrowingDependencies(t: TestContext) {
    return createDependencies(t, {
        findGuild: t.mock.fn(async () => {
            throw new Error("guild lookup should not run");
        }),
        isGuildMember: t.mock.fn(async () => {
            throw new Error("membership lookup should not run");
        }),
        getBroadcastInfo: t.mock.fn(async () => {
            throw new Error("broadcast lookup should not run");
        }),
    });
}

function createDependencies(t: TestContext, overrides: Partial<GuildDirectoryBroadcastInfoDependencies> = {}): GuildDirectoryBroadcastInfoDependencies {
    return {
        findGuild: t.mock.fn(async () => ({ id: guildId })),
        isGuildMember: t.mock.fn(async () => true),
        getBroadcastInfo: t.mock.fn(async (_guildId, _userId, query) => getConservativeBroadcastInfo(query)),
        ...overrides,
    };
}

function assertBroadcastFieldError(action: () => unknown, field: string, code: string) {
    assert.throws(action, (error) => {
        const fieldError = error as { errors?: Record<string, { _errors?: { code?: string }[] }> };
        assert.equal(fieldError.errors?.[field]?._errors?.[0]?.code, code);
        return true;
    });
}

function mockOf<T extends (...args: never[]) => unknown>(fn: T) {
    return fn as T & {
        mock: {
            callCount(): number;
            calls: Array<{ arguments: Parameters<T> }>;
        };
    };
}

function readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as T;
}

type JsonSchema = {
    type?: string;
    $ref?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                summary?: string;
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
                parameters?: Array<{
                    name?: string;
                    in?: string;
                    required?: boolean;
                    schema?: {
                        type?: string;
                    };
                }>;
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
            hasQuery?: boolean;
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SourceRouteCatalogEntry = {
    method?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};

type HttpContractCatalog = {
    contracts?: {
        authMode?: string;
        contractChecks?: string[];
        manifestId?: string;
        routeMetadata?: {
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SuiteCoverageCatalog = {
    groups?: unknown[];
};

type MissingRoutesReport = {
    missing_entries: {
        method?: string;
        route?: string;
    }[];
};
