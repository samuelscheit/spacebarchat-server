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
import type { GuildOnboardingPrompt, GuildOnboardingResponse } from "@spacebar/schemas";
import express from "express";
import guildOnboardingRouter, {
    buildDefaultGuildOnboardingResponse,
    createGuildOnboardingRouter,
    getGuildOnboarding,
    type GuildOnboardingRepositories,
} from "../../src/api/routes/guilds/#guild_id/onboarding";
import { nonCoercingAjv, validateSchema } from "../../src/schemas/Validator";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const requireModule = require;
const coveredManifestId = "api:http:GET:/guilds/:guild_id/onboarding/";

describe("GET /guilds/:guild_id/onboarding", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/onboarding/");
    });

    test("builds a source-compatible disabled onboarding response without shared mutable state", () => {
        const first = buildDefaultGuildOnboardingResponse("100000000000000001");
        first.prompts.push(createOnboardingPrompt());
        first.default_channel_ids.push("100000000000000002");

        assert.deepEqual(buildDefaultGuildOnboardingResponse("100000000000000001"), {
            guild_id: "100000000000000001",
            prompts: [],
            default_channel_ids: [],
            enabled: false,
            below_requirements: true,
            mode: 0,
        });
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/guilds/100000000000000001/onboarding"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/guilds/100000000000000001/onboarding"), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/onboarding", guildOnboardingRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/guilds/100000000000000001/onboarding");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("requires MANAGE_GUILD, checks guild existence, and returns disabled local onboarding defaults", async (t) => {
        const permissionLookups: unknown[][] = [];
        const guildLookups: unknown[] = [];
        mockPermissions(t, true, permissionLookups);

        const app = createAuthenticatedRouteApp(createRepositories({ guildLookups }));
        const response = await requestJson(app, "/guilds/100000000000000001/onboarding");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            guild_id: "100000000000000001",
            prompts: [],
            default_channel_ids: [],
            enabled: false,
            below_requirements: true,
            mode: 0,
        });
        assert.deepEqual(guildLookups, [
            {
                where: { id: "100000000000000001" },
                select: { id: true },
            },
        ]);
        assert.deepEqual(permissionLookups, [["viewer", "100000000000000001", undefined]]);
    });

    test("returns 403 when the authenticated user lacks MANAGE_GUILD", async (t) => {
        const guildLookups: unknown[] = [];
        mockPermissions(t, false);

        const app = createAuthenticatedRouteApp(createRepositories({ guildLookups }));
        const response = await requestJson(app, "/guilds/100000000000000001/onboarding");

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 50013);
        assert.deepEqual(guildLookups, []);
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

        await assert.rejects(() => getGuildOnboarding("missing-guild", repositories), {
            name: "EntityNotFoundError",
        });
    });

    test("validates the documented guild onboarding response shape", () => {
        const payload: GuildOnboardingResponse = {
            guild_id: "100000000000000001",
            prompts: [createOnboardingPrompt()],
            default_channel_ids: ["100000000000000002", "100000000000000003"],
            enabled: true,
            below_requirements: false,
            mode: 1,
        };
        const validateWithoutCoercion = nonCoercingAjv.getSchema("GuildOnboardingResponse");

        assert.deepEqual(validateSchema("GuildOnboardingResponse", payload), payload);
        assert.ok(validateWithoutCoercion, "GuildOnboardingResponse should be registered with the non-coercing validator");
        assert.equal(validateWithoutCoercion(payload), true);
        assert.equal(validateWithoutCoercion({ ...payload, mode: 2 }), false);
        assert.equal(validateWithoutCoercion({ ...payload, guild_id: 12345 }), false);
        assert.equal(validateWithoutCoercion({ ...payload, prompts: [{ ...payload.prompts[0], type: 2 }] }), false);
        assert.equal(validateWithoutCoercion({ ...payload, default_channel_ids: [12345] }), false);
    });

    test("declares source-backed route metadata in source and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "onboarding.ts"), "utf8");
        const schemas = readJson<SchemaMap>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<OpenApi>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /summary:\s*"Get Guild Onboarding"/);
        assert.match(routeSource, /does not currently persist Discord's onboarding prompts/);
        assert.match(routeSource, /permission:\s*"MANAGE_GUILD"/);
        assert.doesNotMatch(routeSource, /router\.put/);
        assert.doesNotMatch(routeSource, /onboarding-prompts/);
        assert.doesNotMatch(routeSource, /onboarding-responses/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildOnboardingResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.deepEqual(schemas.GuildOnboardingResponse.required?.sort(), ["below_requirements", "default_channel_ids", "enabled", "guild_id", "mode", "prompts"]);
        assert.equal(schemas.GuildOnboardingResponse.properties?.guild_id?.type, "string");
        assert.equal(schemas.GuildOnboardingResponse.properties?.prompts?.items?.$ref, "#/definitions/GuildOnboardingPrompt");
        assert.equal(schemas.GuildOnboardingResponse.properties?.default_channel_ids?.items?.type, "string");
        assert.equal(schemas.GuildOnboardingResponse.properties?.enabled?.type, "boolean");
        assert.equal(schemas.GuildOnboardingResponse.properties?.below_requirements?.type, "boolean");
        assert.equal(schemas.GuildOnboardingResponse.properties?.mode?.$ref, "#/definitions/GuildOnboardingMode");
        assert.deepEqual(schemas.GuildOnboardingMode.enum, [0, 1]);
        assert.equal(schemas.GuildOnboardingPrompt.properties?.type?.$ref, "#/definitions/GuildOnboardingPromptType");
        assert.deepEqual(schemas.GuildOnboardingPromptType.enum, [0, 1]);
        assert.deepEqual(schemas.GuildOnboardingPrompt.required?.sort(), ["id", "in_onboarding", "options", "required", "single_select", "title", "type"]);
        assert.deepEqual(schemas.GuildOnboardingPromptOption.required?.sort(), ["channel_ids", "description", "id", "role_ids", "title"]);

        const route = openapi.paths?.["/guilds/{guild_id}/onboarding/"]?.get;
        assert.equal(route?.summary, "Get Guild Onboarding");
        assert.equal(route?.["x-permission-required"], "MANAGE_GUILD");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildOnboardingResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/onboarding.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "GuildOnboardingResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/onboarding");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_ONBOARDING");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/onboarding.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildOnboardingResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.equal(contract?.routeMetadata?.responses?.includes("GuildOnboardingResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/onboarding"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PUT" && entry.route === "/guilds/{param}/onboarding"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.route === "/guilds/{param}/onboarding-prompts/{param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.route === "/guilds/{param}/onboarding-responses"),
            true,
        );
    });
});

function createOnboardingPrompt(): GuildOnboardingPrompt {
    return {
        id: "100000000000000010",
        title: "What do you want to do here?",
        options: [
            {
                id: "100000000000000011",
                title: "Chat with friends",
                description: "Join the general conversation.",
                emoji: {
                    id: null,
                    name: "wave",
                    animated: false,
                },
                role_ids: ["100000000000000012"],
                channel_ids: ["100000000000000002"],
            },
        ],
        single_select: false,
        required: false,
        in_onboarding: true,
        type: 0,
    };
}

function createRepositories({
    guildLookups = [],
}: {
    guildLookups?: unknown[];
} = {}): GuildOnboardingRepositories {
    return {
        guildRepository: {
            findOneOrFail: async (findOptions: unknown) => {
                guildLookups.push(findOptions);
                return { id: "100000000000000001" };
            },
        },
    };
}

function mockPermissions(t: TestContext, hasManageGuild: boolean, permissionLookups: unknown[][] = []) {
    const permissionsModule = requireModule(join(process.cwd(), "dist", "util", "util", "Permissions.js")) as typeof import("../../src/util/util/Permissions");

    t.mock.method(permissionsModule, "getPermission", async (...args: unknown[]) => {
        permissionLookups.push(args);
        return {
            has: () => hasManageGuild,
        } as never;
    });
}

function createAuthenticatedRouteApp(repositories: GuildOnboardingRepositories) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/onboarding", createGuildOnboardingRouter(repositories));
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

type JsonSchema = {
    $ref?: string;
    type?: string | string[];
    enum?: unknown[];
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
};

type SchemaMap = Record<string, JsonSchema>;

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
