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
import { EntityNotFoundError } from "typeorm";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    GUILD_MEMBERS_SUPPLEMENTAL_MUTATION_UNSUPPORTED_MESSAGE,
    buildGuildMembersSupplementalResponse,
    createGuildMembersSupplementalMutationUnsupportedError,
    createGuildMembersSupplementalRouter,
    type GuildMembersSupplementalMemberSource,
    type GuildMembersSupplementalRepositories,
} from "../../src/api/routes/guilds/#guild_id/members/supplemental";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { GuildMemberJoinSourceType } from "../../src/schemas";

const requireModule = require;

const guildId = "200000000000000002";
const viewerId = "100000000000000001";
const coveredGetManifestId = "api:http:GET:/guilds/:guild_id/members/supplemental/";
const coveredPutManifestId = "api:http:PUT:/guilds/:guild_id/members/supplemental/";

describe("GET /guilds/:guild_id/members/supplemental helpers", () => {
    test("serializes only locally persisted join provenance", () => {
        const response = buildGuildMembersSupplementalResponse([
            { id: "member-with-provenance", joined_by: "actor-user" },
            { id: "member-without-provenance", joined_by: "" },
            { id: "member-with-null-provenance", joined_by: null as unknown as string },
        ]);

        assert.deepEqual(response, [
            {
                user_id: "member-with-provenance",
                join_source_type: GuildMemberJoinSourceType.Unspecified,
                inviter_id: "actor-user",
            },
        ]);
        assert.equal("member" in response[0], false);
        assert.equal("source_invite_code" in response[0], false);
        assert.equal("integration_type" in response[0], false);
    });

    test("uses an explicit unsupported mutation API error", () => {
        const error = createGuildMembersSupplementalMutationUnsupportedError();

        assert.equal(error.httpStatus, 501);
        assert.equal(error.code, 0);
        assert.equal(error.message, GUILD_MEMBERS_SUPPLEMENTAL_MUTATION_UNSUPPORTED_MESSAGE);
    });
});

describe("GET /guilds/:guild_id/members/supplemental route", () => {
    test("stays behind bearer authentication", async (t) => {
        const repositories = createThrowingRepositories(t);

        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/members/supplemental`), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/members/supplemental", createGuildMembersSupplementalRouter(repositories));
        app.use(ErrorHandler);

        const response = await requestJson(app, `/guilds/${guildId}/members/supplemental`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(repositories.guildRepository!.findOneOrFail).mock.callCount(), 0);
        assert.equal(mockOf(repositories.memberRepository!.find).mock.callCount(), 0);
    });

    test("declares MANAGE_GUILD route metadata before reading supplemental member provenance", (t) => {
        const { repositories, routeOptions } = createApp(t, {
            repositories: createThrowingRepositories(t),
        });

        assert.equal(routeOptions.permission, "MANAGE_GUILD");
        assert.equal(routeOptions.responses?.["200"]?.body, "GuildMembersSupplementalResponse");
        assert.equal(routeOptions.responses?.["401"]?.body, "APIErrorResponse");
        assert.equal(routeOptions.responses?.["403"]?.body, "APIErrorResponse");
        assert.equal(routeOptions.responses?.["404"]?.body, "APIErrorResponse");
        assert.equal(mockOf(repositories.guildRepository!.findOneOrFail).mock.callCount(), 0);
        assert.equal(mockOf(repositories.memberRepository!.find).mock.callCount(), 0);
    });

    test("requires MANAGE_GUILD before reading supplemental member provenance", async (t) => {
        const permissionLookups: { userId: string; checkedGuildId: string; checkedChannelId: unknown }[] = [];
        const permissionsModule = requireModule(join(process.cwd(), "dist", "util", "util", "Permissions.js")) as PermissionModule;
        const repositories = createThrowingRepositories(t);

        t.mock.method(permissionsModule, "getPermission", async (userId: unknown, checkedGuildId: unknown, checkedChannelId: unknown) => {
            permissionLookups.push({
                userId: String(userId),
                checkedGuildId: String(checkedGuildId),
                checkedChannelId,
            });

            return {
                has: () => false,
            };
        });

        const app = express();
        app.use((req, _res, next) => {
            req.user_id = viewerId;
            next();
        });
        app.use("/guilds/:guild_id/members/supplemental", createGuildMembersSupplementalRouter(repositories));
        app.use(ErrorHandler);

        const response = await requestJson(app, `/guilds/${guildId}/members/supplemental`);

        assert.equal(response.status, 403);
        assert.match((response.body as { message?: string }).message ?? "", /MANAGE_GUILD/);
        assert.deepEqual(permissionLookups, [{ userId: viewerId, checkedGuildId: guildId, checkedChannelId: undefined }]);
        assert.equal(mockOf(repositories.guildRepository!.findOneOrFail).mock.callCount(), 0);
        assert.equal(mockOf(repositories.memberRepository!.find).mock.callCount(), 0);
    });

    test("returns supported joined_by provenance for guild managers", async (t) => {
        const repositories = createRepositories(t, {
            members: [
                { id: "member-b", joined_by: "actor-b" },
                { id: "member-empty", joined_by: "" },
                { id: "member-a", joined_by: "actor-a" },
            ],
        });
        const { app } = createApp(t, { repositories });

        const response = await requestJson(app, `/guilds/${guildId}/members/supplemental`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [
            {
                user_id: "member-b",
                join_source_type: GuildMemberJoinSourceType.Unspecified,
                inviter_id: "actor-b",
            },
            {
                user_id: "member-a",
                join_source_type: GuildMemberJoinSourceType.Unspecified,
                inviter_id: "actor-a",
            },
        ]);
        assert.deepEqual(mockOf(repositories.guildRepository!.findOneOrFail).mock.calls[0].arguments, [
            {
                where: { id: guildId },
                select: { id: true },
            },
        ]);
        const memberFindOptions = mockOf(repositories.memberRepository!.find).mock.calls[0].arguments[0] as MemberFindOptions;
        assert.equal(memberFindOptions.where.guild_id, guildId);
        assert.ok(memberFindOptions.where.joined_by, "member query should exclude null joined_by values");
        assert.deepEqual(memberFindOptions.select, { id: true, joined_by: true });
        assert.deepEqual(memberFindOptions.order, { id: "ASC" });
    });

    test("returns the existing API 404 when the guild does not exist", async (t) => {
        const repositories = createRepositories(t, { missingGuild: true });
        const { app } = createApp(t, { repositories });

        const response = await requestJson(app, `/guilds/missing-guild/members/supplemental`);

        assert.equal(response.status, 404);
        assert.equal((response.body as { code?: number }).code, 404);
        assert.equal((response.body as { message?: string }).message, "Guild could not be found");
        assert.equal(mockOf(repositories.memberRepository!.find).mock.callCount(), 0);
    });

    test("declares schemas, generated route artifacts, GET and PUT missing-route removal, and adjacent methods untouched", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "members", "supplemental.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const contracts = readJson<HttpContractCatalog>(join("test", "generated", "http-contracts.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /summary:\s*"Get Guild Members Supplemental"/);
        assert.match(routeSource, /permission:\s*"MANAGE_GUILD"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildMembersSupplementalResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /router\.put\(/);
        assert.match(routeSource, /summary:\s*"Update Guild Members Supplemental"/);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(delete|patch|post)\(/);

        assert.equal(schemas.GuildMembersSupplementalResponse?.type, "array");
        assert.equal(schemas.GuildMembersSupplementalResponse?.items?.$ref, "#/definitions/GuildMemberSupplemental");
        assert.deepEqual(schemas.GuildMemberSupplemental?.required?.sort(), ["join_source_type", "user_id"]);
        assert.equal(schemas.GuildMemberSupplemental?.properties?.user_id?.type, "string");
        assert.equal(schemas.GuildMemberSupplemental?.properties?.join_source_type?.$ref, "#/definitions/GuildMemberJoinSourceType");
        assert.deepEqual(schemas.GuildMemberJoinSourceType?.enum, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
        assert.deepEqual(schemas.GuildMemberSupplemental?.properties?.inviter_id?.type, ["null", "string"]);

        const route = openapi.paths?.["/guilds/{guild_id}/members/supplemental/"]?.get ?? openapi.paths?.["/guilds/{guild_id}/members/supplemental"]?.get;
        assert.equal(route?.summary, "Get Guild Members Supplemental");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildMembersSupplementalResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const putRoute = openapi.paths?.["/guilds/{guild_id}/members/supplemental/"]?.put ?? openapi.paths?.["/guilds/{guild_id}/members/supplemental"]?.put;
        assert.equal(putRoute?.summary, "Update Guild Members Supplemental");
        assert.equal(putRoute?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(putRoute?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(putRoute?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(putRoute?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(putRoute?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/members/supplemental/"]?.delete, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/members/supplemental/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/members/supplemental/"]?.post, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredGetManifestId || entry.id === coveredGetManifestId.slice(0, -1));
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/members/supplemental.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildMembersSupplementalResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        const putManifestEntry = manifest.entries?.find((entry) => entry.id === coveredPutManifestId || entry.id === coveredPutManifestId.slice(0, -1));
        assert.equal(putManifestEntry?.authMode, "bearer");
        assert.equal(putManifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/members/supplemental.ts");
        assert.equal(putManifestEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.deepEqual(putManifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            putManifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [401, 403, 404, 501],
        );

        const contractEntry = contracts.contracts.find((entry) => entry.manifestId === coveredGetManifestId || entry.manifestId === coveredGetManifestId.slice(0, -1));
        assert.equal(contractEntry?.sourceFile, "src/api/routes/guilds/#guild_id/members/supplemental.ts");
        assert.equal(contractEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.deepEqual(contractEntry?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "GuildMembersSupplementalResponse"]);

        const putContractEntry = contracts.contracts.find((entry) => entry.manifestId === coveredPutManifestId || entry.manifestId === coveredPutManifestId.slice(0, -1));
        assert.equal(putContractEntry?.sourceFile, "src/api/routes/guilds/#guild_id/members/supplemental.ts");
        assert.equal(putContractEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.deepEqual(putContractEntry?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(
            putContractEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [401, 403, 404, 501],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/members/supplemental");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_MEMBERS_SUPPLEMENTAL");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/members/supplemental.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildMembersSupplementalResponse"]);

        const putCatalogEntry = sourceCatalog.find((entry) => entry.method === "PUT" && entry.route === "/guilds/{guild_id}/members/supplemental");
        assert.equal(putCatalogEntry?.route_name, "PUT_GUILDS_GUILD_ID_MEMBERS_SUPPLEMENTAL");
        assert.equal(putCatalogEntry?.source, "src/api/routes/guilds/#guild_id/members/supplemental.ts");
        assert.deepEqual(putCatalogEntry?.response_schema_refs, ["APIErrorResponse"]);
        assert.equal(
            sourceCatalog.some((entry) => ["DELETE", "PATCH", "POST"].includes(entry.method ?? "") && entry.route === "/guilds/{guild_id}/members/supplemental"),
            false,
        );

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/members/supplemental"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PUT" && entry.route === "/guilds/{param}/members/supplemental"),
            false,
        );
        assert.deepEqual(
            missingRoutes.missing_entries
                .filter((entry) => entry.route === "/guilds/{param}/members/supplemental")
                .map((entry) => entry.method)
                .sort(),
            ["DELETE", "PATCH", "POST"],
        );
    });
});

describe("PUT /guilds/:guild_id/members/supplemental route", () => {
    test("stays behind bearer authentication", async (t) => {
        const repositories = createThrowingRepositories(t);

        assert.equal(isNoAuthorizationRoute("PUT", `/api/v9/guilds/${guildId}/members/supplemental`), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/members/supplemental", createGuildMembersSupplementalRouter(repositories));
        app.use(ErrorHandler);

        const response = await requestJson(app, `/guilds/${guildId}/members/supplemental`, { method: "PUT" });

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(repositories.guildRepository!.findOneOrFail).mock.callCount(), 0);
        assert.equal(mockOf(repositories.memberRepository!.find).mock.callCount(), 0);
    });

    test("declares MANAGE_GUILD route metadata before unsupported mutation handling", (t) => {
        const { repositories, putRouteOptions } = createApp(t, {
            repositories: createThrowingRepositories(t),
        });

        assert.equal(putRouteOptions.permission, "MANAGE_GUILD");
        assert.equal(putRouteOptions.responses?.["401"]?.body, "APIErrorResponse");
        assert.equal(putRouteOptions.responses?.["403"]?.body, "APIErrorResponse");
        assert.equal(putRouteOptions.responses?.["404"]?.body, "APIErrorResponse");
        assert.equal(putRouteOptions.responses?.["501"]?.body, "APIErrorResponse");
        assert.equal(mockOf(repositories.guildRepository!.findOneOrFail).mock.callCount(), 0);
        assert.equal(mockOf(repositories.memberRepository!.find).mock.callCount(), 0);
    });

    test("requires MANAGE_GUILD before checking guild state or failing closed", async (t) => {
        const permissionLookups: { userId: string; checkedGuildId: string; checkedChannelId: unknown }[] = [];
        const permissionsModule = requireModule(join(process.cwd(), "dist", "util", "util", "Permissions.js")) as PermissionModule;
        const repositories = createThrowingRepositories(t);

        t.mock.method(permissionsModule, "getPermission", async (userId: unknown, checkedGuildId: unknown, checkedChannelId: unknown) => {
            permissionLookups.push({
                userId: String(userId),
                checkedGuildId: String(checkedGuildId),
                checkedChannelId,
            });

            return {
                has: () => false,
            };
        });

        const app = express();
        app.use((req, _res, next) => {
            req.user_id = viewerId;
            next();
        });
        app.use("/guilds/:guild_id/members/supplemental", createGuildMembersSupplementalRouter(repositories));
        app.use(ErrorHandler);

        const response = await requestJson(app, `/guilds/${guildId}/members/supplemental`, { method: "PUT" });

        assert.equal(response.status, 403);
        assert.match((response.body as { message?: string }).message ?? "", /MANAGE_GUILD/);
        assert.deepEqual(permissionLookups, [{ userId: viewerId, checkedGuildId: guildId, checkedChannelId: undefined }]);
        assert.equal(mockOf(repositories.guildRepository!.findOneOrFail).mock.callCount(), 0);
        assert.equal(mockOf(repositories.memberRepository!.find).mock.callCount(), 0);
    });

    test("fails closed for guild managers without mutating local supplemental provenance", async (t) => {
        const repositories = createRepositories(t, {
            members: [{ id: "member-a", joined_by: "actor-a" }],
        });
        const { app } = createApp(t, { repositories });

        const response = await requestJson(app, `/guilds/${guildId}/members/supplemental`, { method: "PUT" });

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: GUILD_MEMBERS_SUPPLEMENTAL_MUTATION_UNSUPPORTED_MESSAGE,
        });
        assert.deepEqual(mockOf(repositories.guildRepository!.findOneOrFail).mock.calls[0].arguments, [
            {
                where: { id: guildId },
                select: { id: true },
            },
        ]);
        assert.equal(mockOf(repositories.memberRepository!.find).mock.callCount(), 0);
    });

    test("returns the existing API 404 when the guild does not exist", async (t) => {
        const repositories = createRepositories(t, { missingGuild: true });
        const { app } = createApp(t, { repositories });

        const response = await requestJson(app, `/guilds/missing-guild/members/supplemental`, { method: "PUT" });

        assert.equal(response.status, 404);
        assert.equal((response.body as { code?: number }).code, 404);
        assert.equal((response.body as { message?: string }).message, "Guild could not be found");
        assert.equal(mockOf(repositories.memberRepository!.find).mock.callCount(), 0);
    });
});

function createApp(t: TestContext, options: { repositories: GuildMembersSupplementalRepositories }) {
    const routeHandler = requireModule(join(process.cwd(), "dist", "api", "util", "handlers", "route.js")) as RouteHandlerModule;
    const routeOptions: RouteOptions[] = [];

    t.mock.method(routeHandler, "route", (routeOption: RouteOptions) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    const app = express();
    app.use((req, _res, next) => {
        req.user_id = viewerId;
        next();
    });
    app.use("/guilds/:guild_id/members/supplemental", createGuildMembersSupplementalRouter(options.repositories));
    app.use(ErrorHandler);

    return {
        app,
        repositories: options.repositories,
        get routeOptions() {
            return routeOptions[0] ?? {};
        },
        get putRouteOptions() {
            return routeOptions[1] ?? {};
        },
    };
}

function createThrowingRepositories(t: TestContext): Required<GuildMembersSupplementalRepositories> {
    return createRepositories(t, {
        guildError: new Error("guild lookup should not run"),
        memberError: new Error("member lookup should not run"),
    });
}

function createRepositories(
    t: TestContext,
    options: {
        guildError?: Error;
        memberError?: Error;
        members?: GuildMembersSupplementalMemberSource[];
        missingGuild?: boolean;
    } = {},
): Required<GuildMembersSupplementalRepositories> {
    const guildRepository = {
        findOneOrFail: t.mock.fn(async (findOptions: { where?: { id?: string } }) => {
            if (options.guildError) throw options.guildError;
            if (options.missingGuild) throw new EntityNotFoundError("Guild", findOptions.where);

            return { id: findOptions.where?.id };
        }),
    };
    const memberRepository = {
        find: t.mock.fn(async () => {
            if (options.memberError) throw options.memberError;

            return options.members ?? [];
        }),
    };

    return { guildRepository, memberRepository };
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

type MemberFindOptions = {
    where: {
        guild_id?: string;
        joined_by?: unknown;
    };
    select?: unknown;
    order?: unknown;
};

type JsonSchema = {
    type?: string | string[];
    $ref?: string;
    enum?: unknown[];
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
};

type RouteHandlerModule = {
    route(options: RouteOptions): express.RequestHandler;
};

type RouteOptions = {
    permission?: string;
    responses?: Record<string, { body?: string }>;
};

type PermissionModule = {
    getPermission(
        userId: unknown,
        guildId: unknown,
        channelId: unknown,
    ): Promise<{
        has(permission: unknown): boolean;
    }>;
};

type JsonSchemaRef = {
    $ref?: string;
};

type OpenApiOperation = {
    summary?: string;
    responses?: Record<string, { content?: Record<string, { schema?: JsonSchemaRef }> }>;
    security?: unknown;
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            delete?: unknown;
            get?: OpenApiOperation;
            patch?: unknown;
            post?: unknown;
            put?: OpenApiOperation;
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

type HttpContractCatalog = {
    contracts: {
        manifestId?: string;
        sourceFile?: string;
        routeMetadata?: {
            permission?: string;
            responses?: string[];
            responseStatuses?: number[];
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
