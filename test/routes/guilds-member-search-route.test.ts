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
import { HTTPError } from "lambert-server";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createGuildMemberSearchRouter,
    escapeLikePattern,
    findGuildMembersByQuery,
    parseGuildMemberSearchQuery,
    type GuildMemberSearchDependencies,
    type GuildMemberSearchSource,
} from "../../src/api/routes/guilds/#guild_id/members/search";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { DiscordApiErrors, Member } from "../../src/util";

const util = require("@spacebar/util") as typeof import("../../src/util");

const guildId = "200000000000000002";
const viewerId = "100000000000000001";
const coveredManifestId = "api:http:GET:/guilds/:guild_id/members/search/";

describe("GET /guilds/:guild_id/members/search helpers", () => {
    test("parses required query and bounded integer limit", () => {
        assert.deepEqual(parseGuildMemberSearchQuery({ query: "ali" } as never), { query: "ali", limit: 1 });
        assert.deepEqual(parseGuildMemberSearchQuery({ query: ["ali", "ignored"], limit: "25" } as never), { query: "ali", limit: 25 });

        assert.throws(() => parseGuildMemberSearchQuery({} as never), /Query is required/);
        assert.throws(() => parseGuildMemberSearchQuery({ query: "ali", limit: "0" } as never), /Limit must be between 1 and 1000/);
        assert.throws(() => parseGuildMemberSearchQuery({ query: "ali", limit: "1001" } as never), /Limit must be between 1 and 1000/);
        assert.throws(() => parseGuildMemberSearchQuery({ query: "ali", limit: "1.5" } as never), /Limit must be between 1 and 1000/);
    });

    test("escapes SQL LIKE wildcard input before building contains search", async (t) => {
        assert.equal(escapeLikePattern(String.raw`50%_off\deal`), String.raw`50\%\_off\\deal`);

        const queryBuilder = createQueryBuilder(t, [member("user-1")]);
        t.mock.method(util.Member, "createQueryBuilder", () => queryBuilder.builder as never);

        const result = await findGuildMembersByQuery(guildId, String.raw`50%_off\deal`, 25);

        assert.equal(result.length, 1);
        assert.deepEqual(queryBuilder.calls[0], { method: "leftJoinAndSelect", args: ["member.user", "user"] });
        assert.deepEqual(queryBuilder.calls[1], { method: "leftJoinAndSelect", args: ["member.roles", "role"] });
        assert.deepEqual(queryBuilder.calls[2], { method: "where", args: ["member.guild_id = :guildId", { guildId }] });
        assert.deepEqual(queryBuilder.calls[3], {
            method: "andWhere",
            args: ["(user.username ILIKE :pattern ESCAPE '\\' OR member.nick ILIKE :pattern ESCAPE '\\')", { pattern: String.raw`%50\%\_off\\deal%` }],
        });
        assert.equal((queryBuilder.calls.find((call) => call.method === "select")?.args[0] as string[]).includes("member.roles"), false);
        assert.equal((queryBuilder.calls.find((call) => call.method === "select")?.args[0] as string[]).includes("role.id"), true);
        assert.deepEqual(queryBuilder.calls.find((call) => call.method === "take")?.args, [25]);
    });
});

describe("GET /guilds/:guild_id/members/search route", () => {
    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/members/search?query=ali`), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/members/search", createGuildMemberSearchRouter(dependencies));
        app.use(ErrorHandler);

        const response = await requestJson(app, `/guilds/${guildId}/members/search?query=ali`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.assertMemberInGuild).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findMembers).mock.callCount(), 0);
    });

    test("rejects non-bot tokens before member lookup", async (t) => {
        const dependencies = createThrowingDependencies(t);
        const response = await requestJson(createApp(dependencies, { userIsBot: false }), `/guilds/${guildId}/members/search?query=ali`);

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.BOT_ONLY_ENDPOINT.code,
            message: DiscordApiErrors.BOT_ONLY_ENDPOINT.message,
        });
        assert.equal(mockOf(dependencies.assertMemberInGuild).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findMembers).mock.callCount(), 0);
    });

    test("requires the requesting bot to be a guild member before search", async (t) => {
        const dependencies = createDependencies(t, {
            assertMemberInGuild: t.mock.fn(async () => {
                throw new HTTPError("not a member", 403);
            }),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/members/search?query=ali`);

        assert.equal(response.status, 403);
        assert.deepEqual(mockOf(dependencies.assertMemberInGuild).mock.calls[0].arguments, [viewerId, guildId]);
        assert.equal(mockOf(dependencies.findMembers).mock.callCount(), 0);
    });

    test("returns serialized members for the query and limit", async (t) => {
        const dependencies = createDependencies(t, {
            findMembers: t.mock.fn(async () => [member("user-2"), member("user-1")]),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/members/search?query=ali&limit=2`);

        assert.equal(response.status, 200);
        assert.deepEqual(
            (response.body as PublicMemberBody[]).map((entry) => entry.user.id),
            ["user-2", "user-1"],
        );
        assert.deepEqual(mockOf(dependencies.assertMemberInGuild).mock.calls[0].arguments, [viewerId, guildId]);
        assert.deepEqual(mockOf(dependencies.findMembers).mock.calls[0].arguments, [guildId, "ali", 2]);
    });

    test("declares response schemas and generated route artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "members", "search.ts"), "utf8");
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const contracts = readJson<HttpContractCatalog>(join("test", "generated", "http-contracts.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Query Guild Members"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"APIMemberArray"/s);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);

        const route = openapi.paths?.["/guilds/{guild_id}/members/search/"]?.get ?? openapi.paths?.["/guilds/{guild_id}/members/search"]?.get;
        assert.equal(route?.summary, "Query Guild Members");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIMemberArray");
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId || entry.id === coveredManifestId.slice(0, -1));
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIMemberArray"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 400, 401, 403],
        );

        const contractEntry = contracts.contracts.find((entry) => entry.manifestId === coveredManifestId || entry.manifestId === coveredManifestId.slice(0, -1));
        assert.equal(contractEntry?.sourceFile, "src/api/routes/guilds/#guild_id/members/search.ts");
        assert.deepEqual(contractEntry?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "APIMemberArray"]);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/members/search");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_MEMBERS_SEARCH");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/members/search.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "APIMemberArray"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/members/search"),
            false,
        );
    });
});

function createApp(dependencies: GuildMemberSearchDependencies, options: { userIsBot?: boolean } = {}) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = viewerId;
        req.user_bot = options.userIsBot ?? true;
        next();
    });
    app.use("/guilds/:guild_id/members/search", createGuildMemberSearchRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createThrowingDependencies(t: TestContext) {
    return createDependencies(t, {
        assertMemberInGuild: t.mock.fn(async () => {
            throw new Error("member lookup should not run");
        }),
        findMembers: t.mock.fn(async () => {
            throw new Error("search should not run");
        }),
    });
}

function createDependencies(t: TestContext, overrides: Partial<GuildMemberSearchDependencies> = {}): GuildMemberSearchDependencies {
    return {
        assertMemberInGuild: t.mock.fn(async () => undefined),
        findMembers: t.mock.fn(async () => []),
        ...overrides,
    };
}

function member(userId: string): GuildMemberSearchSource {
    return {
        toPublicMember() {
            return {
                id: userId,
                guild_id: guildId,
                nick: null,
                roles: ["role-id"],
                joined_at: new Date("2026-01-02T03:04:05.000Z"),
                pending: false,
                deaf: false,
                mute: false,
                premium_since: null,
                avatar: null,
                banner: null,
                bio: "",
                theme_colors: null,
                pronouns: "",
                communication_disabled_until: null,
                avatar_decoration_data: null,
                display_name_styles: null,
                collectibles: null,
                flags: 0,
                user: {
                    id: userId,
                    username: userId,
                    discriminator: "0001",
                    public_flags: 0,
                    avatar: null,
                    accent_color: null,
                    banner: null,
                    bio: "",
                    bot: false,
                    premium_since: null,
                    premium_type: 0,
                    theme_colors: null,
                    pronouns: "",
                    badge_ids: [],
                    avatar_decoration_data: null,
                    display_name_styles: null,
                    collectibles: null,
                    primary_guild: null,
                },
            } as never;
        },
    };
}

function createQueryBuilder(t: TestContext, members: GuildMemberSearchSource[]) {
    const calls: QueryBuilderCall[] = [];
    const builder = {
        leftJoinAndSelect: t.mock.fn((...args: unknown[]) => {
            calls.push({ method: "leftJoinAndSelect", args });
            return builder;
        }),
        where: t.mock.fn((...args: unknown[]) => {
            calls.push({ method: "where", args });
            return builder;
        }),
        andWhere: t.mock.fn((...args: unknown[]) => {
            calls.push({ method: "andWhere", args });
            return builder;
        }),
        select: t.mock.fn((...args: unknown[]) => {
            calls.push({ method: "select", args });
            return builder;
        }),
        orderBy: t.mock.fn((...args: unknown[]) => {
            calls.push({ method: "orderBy", args });
            return builder;
        }),
        addOrderBy: t.mock.fn((...args: unknown[]) => {
            calls.push({ method: "addOrderBy", args });
            return builder;
        }),
        take: t.mock.fn((...args: unknown[]) => {
            calls.push({ method: "take", args });
            return builder;
        }),
        getMany: t.mock.fn(async () => members as Member[]),
    };

    return { builder, calls };
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

type PublicMemberBody = {
    user: {
        id: string;
    };
};

type QueryBuilderCall = {
    method: string;
    args: unknown[];
};

type JsonSchemaRef = {
    $ref?: string;
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                summary?: string;
                responses?: Record<string, { content?: Record<string, { schema?: JsonSchemaRef }> }>;
                security?: unknown;
            };
        }
    >;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        routeMetadata?: {
            responseBodies?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type HttpContractCatalog = {
    contracts: {
        manifestId?: string;
        sourceFile?: string;
        routeMetadata?: {
            responses?: string[];
        };
    }[];
};

type SourceRouteCatalogEntry = {
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
