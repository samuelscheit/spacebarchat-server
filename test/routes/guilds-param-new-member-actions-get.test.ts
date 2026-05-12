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
import type { GuildNewMemberAction } from "@spacebar/schemas";
import express from "express";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../src/api/middlewares";
import {
    createGuildNewMemberActionsRouter,
    getCurrentGuildNewMemberActions,
    getGuildNewMemberActionsResponse,
    type GuildNewMemberActionsDependencies,
} from "../../src/api/routes/guilds/#guild_id/new-member-actions";
import { requestJson } from "../../src/api/tests/helpers/UserRouteTestHelpers";
import { nonCoercingAjv, validateSchema } from "../../src/schemas/Validator";
import { DiscordApiErrors } from "../../src/util";

const guildId = "200000000000000002";
const viewerId = "100000000000000001";
const coveredManifestId = "api:http:GET:/guilds/:guild_id/new-member-actions/";

describe("GET /guilds/:guild_id/new-member-actions", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/new-member-actions/");
    });

    test("builds a conservative empty response without shared mutable state", async () => {
        const first = await getCurrentGuildNewMemberActions(guildId);
        first.push(newMemberAction());

        assert.deepEqual(await getCurrentGuildNewMemberActions(guildId), []);
    });

    test("stays behind bearer authentication", async (t) => {
        const dependencies = createThrowingDependencies(t);

        assert.equal(isNoAuthorizationRoute("GET", `/guilds/${guildId}/new-member-actions`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/new-member-actions`), false);

        const response = await requestJson(createAuthenticatedApp(dependencies), `/guilds/${guildId}/new-member-actions`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(mockOf(dependencies.findGuild).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findNewMemberActions).mock.callCount(), 0);
    });

    test("checks guild membership and returns an empty list when no local action source exists", async (t) => {
        const dependencies = createDependencies(t);

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/new-member-actions`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(mockOf(dependencies.findGuild).mock.calls[0].arguments[0], {
            where: { id: guildId },
            select: { id: true },
        });
        assert.deepEqual(mockOf(dependencies.isGuildMember).mock.calls[0].arguments, [viewerId, guildId]);
        assert.deepEqual(mockOf(dependencies.findNewMemberActions).mock.calls[0].arguments, [guildId, viewerId]);
    });

    test("returns locally backed action definitions supplied by the dependency", async (t) => {
        const action = newMemberAction();
        const dependencies = createDependencies(t, {
            findNewMemberActions: t.mock.fn(async () => [action]),
        });

        const response = await getGuildNewMemberActionsResponse(guildId, viewerId, dependencies);

        assert.deepEqual(response, [action]);
        assert.notEqual(response[0], action);
        assert.notEqual(response[0]?.emoji, action.emoji);
    });

    test("returns unknown guild before membership or action lookups", async (t) => {
        const dependencies = createDependencies(t, {
            findGuild: t.mock.fn(async () => null),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/new-member-actions`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_GUILD.code,
            message: DiscordApiErrors.UNKNOWN_GUILD.message,
        });
        assert.equal(mockOf(dependencies.isGuildMember).mock.callCount(), 0);
        assert.equal(mockOf(dependencies.findNewMemberActions).mock.callCount(), 0);
    });

    test("returns forbidden for authenticated users outside the guild", async (t) => {
        const dependencies = createDependencies(t, {
            isGuildMember: t.mock.fn(async () => false),
        });

        const response = await requestJson(createApp(dependencies), `/guilds/${guildId}/new-member-actions`);

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 403);
        assert.equal(mockOf(dependencies.findNewMemberActions).mock.callCount(), 0);
    });

    test("validates the documented new member actions response shape", () => {
        const payload = [newMemberAction()];
        const validateWithoutCoercion = nonCoercingAjv.getSchema("GuildNewMemberActionsResponse");

        assert.deepEqual(validateSchema("GuildNewMemberActionsResponse", payload), payload);
        assert.ok(validateWithoutCoercion, "GuildNewMemberActionsResponse should be registered with the non-coercing validator");
        assert.equal(validateWithoutCoercion(payload), true);
        assert.equal(validateWithoutCoercion([{ ...payload[0], channel_id: 12345 }]), false);
        assert.equal(validateWithoutCoercion([{ ...payload[0], action_type: 2 }]), false);
        assert.equal(validateWithoutCoercion({ new_member_actions: payload }), false);
    });

    test("declares source-backed route metadata in source and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "new-member-actions.ts"), "utf8");
        const schemas = readJson<SchemaMap>(join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join("assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const userdoccersCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.userdoccers.catalog.json"));
        const xhyromCatalog = readJson<SourceRouteCatalogEntry[]>(join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.xhyrom.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join("packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join("test", "generated", "http-contracts.json"));

        assert.match(routeSource, /summary:\s*"Get Guild New Member Actions"/);
        assert.match(routeSource, /per-member new member action completion state/);
        assert.doesNotMatch(routeSource, /permission:\s*"MANAGE_GUILD"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildNewMemberActionsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.GuildNewMemberActionsResponse.type, "array");
        assert.equal(schemas.GuildNewMemberActionsResponse.items?.$ref, "#/definitions/GuildNewMemberAction");
        assert.deepEqual(schemas.GuildNewMemberAction.properties?.action_type?.enum, [0, 1]);
        assert.deepEqual(schemas.GuildNewMemberAction.required?.sort(), ["action_type", "channel_id", "description", "title"]);

        const operation = openapi.paths?.["/guilds/{guild_id}/new-member-actions/"]?.get;
        assert.equal(operation?.summary, "Get Guild New Member Actions");
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildNewMemberActionsResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(operation?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/new-member-actions.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, undefined);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "GuildNewMemberActionsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        const sourceEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/new-member-actions");
        assert.equal(sourceEntry?.route_name, "GET_GUILDS_GUILD_ID_NEW_MEMBER_ACTIONS");
        assert.equal(sourceEntry?.source, "src/api/routes/guilds/#guild_id/new-member-actions.ts");
        assert.deepEqual(sourceEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildNewMemberActionsResponse"]);

        const userdoccersEntry = userdoccersCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/new-member-actions");
        assert.equal(userdoccersEntry?.route_name, "GET_GUILDS_GUILD_ID_NEW_MEMBER_ACTIONS");
        assert.equal(userdoccersEntry?.source, "userdoccers:resources/guild.mdx");
        assert.equal(userdoccersEntry?.summary, "Get Guild New Member Actions");

        const xhyromEntry = xhyromCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/new-member-actions");
        assert.equal(xhyromEntry?.route_name, "GUILD_MEMBER_ACTIONS");
        assert.equal(xhyromEntry?.source, "xhyrom:data/client/routes.json");

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.permission, undefined);
        assert.equal(contract?.routeMetadata?.responses?.includes("GuildNewMemberActionsResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        assert.equal(missingRoutes.routes.includes("/guilds/{param}/new-member-actions"), true);
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/new-member-actions"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "DELETE" && entry.route === "/guilds/{param}/new-member-actions"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PATCH" && entry.route === "/guilds/{param}/new-member-actions/{param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/guilds/{param}/new-member-action/{param}"),
            true,
        );
        assert.equal(
            sourceCatalog.some((entry) => entry.route === "/guilds/{guild_id}/new-member-actions/{param}" || entry.route === "/guilds/{guild_id}/new-member-action/{param}"),
            false,
        );
    });
});

function createApp(dependencies: GuildNewMemberActionsDependencies) {
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = viewerId;
        next();
    });
    app.use("/guilds/:guild_id/new-member-actions", createGuildNewMemberActionsRouter(dependencies));
    app.use(ErrorHandler);
    return app;
}

function createAuthenticatedApp(dependencies: GuildNewMemberActionsDependencies) {
    const app = express();
    app.use(Authentication);
    app.use("/guilds/:guild_id/new-member-actions", createGuildNewMemberActionsRouter(dependencies));
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
        findNewMemberActions: t.mock.fn(async () => {
            throw new Error("new member action lookup should not run");
        }),
    });
}

function createDependencies(t: TestContext, overrides: Partial<GuildNewMemberActionsDependencies> = {}): GuildNewMemberActionsDependencies {
    return {
        findGuild: t.mock.fn(async () => ({ id: guildId })),
        isGuildMember: t.mock.fn(async () => true),
        findNewMemberActions: t.mock.fn(async () => []),
        ...overrides,
    };
}

function newMemberAction(): GuildNewMemberAction {
    return {
        channel_id: "300000000000000003",
        action_type: 0,
        title: "Read the rules",
        description: "Start with the server rules.",
        emoji: {
            id: null,
            name: "wave",
            animated: false,
        },
    };
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
    $ref?: string;
    type?: string | string[];
    enum?: unknown[];
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
};

type SchemaMap = Record<string, JsonSchema>;

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                summary?: string;
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
            permission?: unknown;
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
    summary?: string;
};

type MissingRoutesReport = {
    routes: string[];
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
            permission?: unknown;
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};
