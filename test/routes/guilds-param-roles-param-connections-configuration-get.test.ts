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
import {
    createGuildRoleConnectionConfigurationRouter,
    getGuildRoleConnectionConfiguration,
    type GuildRoleConnectionConfigurationProvider,
} from "../../src/api/routes/guilds/#guild_id/roles/#role_id/connections/configuration";
import { nonCoercingAjv, validateSchema } from "../../src/schemas/Validator";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const requireModule = require;
const coveredManifestId = "api:http:GET:/guilds/:guild_id/roles/:role_id/connections/configuration/";
const assignedPath = "/guilds/{guild_id}/roles/{role_id}/connections/configuration";
const assignedMissingPath = "/guilds/{param}/roles/{param}/connections/configuration";
const assignedRouteName = "GET_GUILDS_GUILD_ID_ROLES_ROLE_ID_CONNECTIONS_CONFIGURATION";
const guildId = "100000000000000001";
const roleId = "100000000000000002";

describe("GET /guilds/:guild_id/roles/:role_id/connections/configuration", () => {
    test("declares the assigned manifest route id and stays behind bearer auth", async () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/roles/:role_id/connections/configuration/");
        assert.equal(isNoAuthorizationRoute("GET", `/guilds/${guildId}/roles/${roleId}/connections/configuration`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/roles/${roleId}/connections/configuration`), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/roles/:role_id/connections/configuration", createGuildRoleConnectionConfigurationRouter());
        app.use(ErrorHandler);

        const response = await requestJson(app, `/guilds/${guildId}/roles/${roleId}/connections/configuration`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("requires manage-roles permission, verifies the role belongs to the guild, and returns the locally backed configuration", async (t) => {
        const permissionLookups: unknown[] = [];
        const roleLookups: unknown[] = [];
        mockManageRolesPermission(t, true, permissionLookups);
        mockRoleLookup(t, roleLookups);

        let providerGuildId: string | undefined;
        let providerRoleId: string | undefined;
        const provider: GuildRoleConnectionConfigurationProvider = (currentGuildId, currentRoleId) => {
            providerGuildId = currentGuildId;
            providerRoleId = currentRoleId;
            return createConfiguration();
        };

        const response = await requestJson(createAuthenticatedRouteApp(provider), `/guilds/${guildId}/roles/${roleId}/connections/configuration`);

        assert.equal(response.status, 200);
        assert.equal(providerGuildId, guildId);
        assert.equal(providerRoleId, roleId);
        assert.deepEqual(permissionLookups, [{ userId: "viewer", guildId, channelId: undefined }]);
        assert.deepEqual(roleLookups, [
            {
                where: { guild_id: guildId, id: roleId },
                select: { id: true },
            },
        ]);
        assert.deepEqual(response.body, createConfiguration());
    });

    test("returns 403 before role lookup when the authenticated user cannot manage roles", async (t) => {
        const permissionLookups: unknown[] = [];
        const roleLookups: unknown[] = [];
        mockManageRolesPermission(t, false, permissionLookups);
        mockRoleLookup(t, roleLookups);

        const response = await requestJson(createAuthenticatedRouteApp(), `/guilds/${guildId}/roles/${roleId}/connections/configuration`);

        assert.equal(response.status, 403);
        assert.match((response.body as { message?: string }).message ?? "", /lack permissions.*MANAGE_ROLES/);
        assert.deepEqual(permissionLookups, [{ userId: "viewer", guildId, channelId: undefined }]);
        assert.deepEqual(roleLookups, []);
    });

    test("returns 404 when the role is outside the requested guild", async (t) => {
        const roleLookups: unknown[] = [];
        mockManageRolesPermission(t, true);
        mockRoleLookup(t, roleLookups, entityNotFound("Role"));

        let providerCalled = false;
        const provider: GuildRoleConnectionConfigurationProvider = () => {
            providerCalled = true;
            return [];
        };

        const response = await requestJson(createAuthenticatedRouteApp(provider), `/guilds/${guildId}/roles/${roleId}/connections/configuration`);

        assert.equal(response.status, 404);
        assert.match((response.body as { message?: string }).message ?? "", /Role could not be found/);
        assert.equal(providerCalled, false);
        assert.deepEqual(roleLookups, [
            {
                where: { guild_id: guildId, id: roleId },
                select: { id: true },
            },
        ]);
    });

    test("does not fabricate role connection requirements without durable local backing", () => {
        const first = getGuildRoleConnectionConfiguration(guildId, roleId);
        const second = getGuildRoleConnectionConfiguration(guildId, roleId);

        assert.deepEqual(first, []);
        assert.deepEqual(second, []);
        assert.notEqual(first, second, "callers should receive a fresh response array");
    });

    test("validates the documented role connection configuration response shape", () => {
        const payload = createConfiguration();
        const validateWithoutCoercion = nonCoercingAjv.getSchema("GuildRoleConnectionConfigurationResponse");

        assert.deepEqual(validateSchema("GuildRoleConnectionConfigurationResponse", payload), payload);
        assert.ok(validateWithoutCoercion, "GuildRoleConnectionConfigurationResponse should be registered with the non-coercing validator");
        assert.equal(validateWithoutCoercion(payload), true);
        assert.equal(validateWithoutCoercion([[{ connection_type: "application", application_id: 12345 }]]), false);
        assert.equal(validateWithoutCoercion([[{ connection_type: "application", application: createIntegrationApplication() }]]), false);
        assert.equal(validateWithoutCoercion([{ connection_type: "application" }]), false);
    });

    test("declares source-backed metadata and generated artifacts for only the exact owned route", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "roles", "#role_id", "connections", "configuration.ts"), "utf8");
        const schemas = readJson<SchemaMap>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<OpenApi>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<SuiteCoverage>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /summary:\s*"Get Guild Role Connection Configuration"/);
        assert.match(routeSource, /permission:\s*"MANAGE_ROLES"/);
        assert.match(routeSource, /does not currently persist Discord linked-role configuration state/);
        assert.match(routeSource, /Role\.findOneOrFail\(\{\s*where:\s*\{\s*guild_id:\s*guildId,\s*id:\s*roleId\s*\}/s);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildRoleConnectionConfigurationResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(?:delete|patch|put|post)\(/);
        assert.doesNotMatch(routeSource, /connections\/eligibility|connections\/assign|connections\/unassign|connections-configurations/);

        assert.equal(schemas.GuildRoleConnectionConfigurationResponse.type, "array");
        assert.equal(schemas.GuildRoleConnectionConfigurationResponse.items?.type, "array");
        assert.equal(schemas.GuildRoleConnectionConfigurationResponse.items?.items?.$ref, "#/definitions/GuildRoleConnectionRequirementResponse");
        assert.equal(schemas.GuildRoleConnectionRequirementResponse.properties?.connection_type?.type, "string");
        assert.equal(schemas.GuildRoleConnectionRequirementResponse.properties?.connection_metadata_field?.type?.includes("null"), true);
        assert.equal(schemas.GuildRoleConnectionRequirementResponse.properties?.operator?.type?.includes("integer"), true);
        assert.equal(schemas.GuildRoleConnectionRequirementResponse.properties?.value?.type?.includes("string"), true);
        assert.equal(schemas.GuildRoleConnectionRequirementResponse.properties?.application_id?.type, "string");
        assert.deepEqual(schemas.GuildRoleConnectionRequirementResponse.required, ["connection_type"]);

        const route = openapi.paths?.["/guilds/{guild_id}/roles/{role_id}/connections/configuration/"]?.get;
        assert.equal(route?.summary, "Get Guild Role Connection Configuration");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildRoleConnectionConfigurationResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/roles/{role_id}/connections/configuration/"]?.put, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/roles/{role_id}/connections/eligibility/"]?.get, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/roles/{role_id}/connections/assign/"]?.put, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/roles/{role_id}/connections/unassign/"]?.post, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, "/guilds/:guild_id/roles/:role_id/connections/configuration/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/roles/#role_id/connections/configuration.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "GuildRoleConnectionConfigurationResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/roles/#role_id/connections/configuration.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildRoleConnectionConfigurationResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "GuildRoleConnectionConfigurationResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );
        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === assignedMissingPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PUT" && entry.route === assignedMissingPath),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/roles/{param}/connections/eligibility"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PUT" && entry.route === "/guilds/{param}/roles/{param}/connections/assign"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "POST" && entry.route === "/guilds/{param}/roles/{param}/connections/unassign"),
            true,
        );
    });
});

const applicationId = "100000000000000099";

function createConfiguration() {
    return [
        [
            {
                connection_type: "application",
                connection_metadata_field: "level",
                operator: 2,
                value: "10",
                application_id: applicationId,
            },
        ],
    ];
}

function createIntegrationApplication() {
    return {
        id: applicationId,
        name: "Example App",
        description: "Example linked-role application",
        summary: "",
        hook: false,
        verify_key: "verify",
        flags: 0,
        redirect_uris: [],
        rpc_application_state: 0,
        store_application_state: 0,
        verification_state: 1,
        integration_public: true,
        integration_require_code_grant: false,
        discoverability_state: 1,
        discovery_eligibility_flags: 0,
    };
}

function mockManageRolesPermission(t: TestContext, allowed: boolean, permissionLookups: unknown[] = []) {
    const permissionsModule = requireModule(join(process.cwd(), "dist", "util", "util", "Permissions.js")) as typeof import("../../src/util/util/Permissions");

    t.mock.method(permissionsModule, "getPermission", async (userId: string, currentGuildId?: string, channelId?: string) => {
        permissionLookups.push({ userId, guildId: currentGuildId, channelId });

        return {
            has() {
                return allowed;
            },
        };
    });
}

function mockRoleLookup(t: TestContext, roleLookups: unknown[], error?: Error) {
    const util = requireModule("@spacebar/util") as typeof import("../../src/util");

    t.mock.method(util.Role, "findOneOrFail", async (findOptions: unknown) => {
        roleLookups.push(findOptions);
        if (error) throw error;
        return { id: roleId };
    });
}

function entityNotFound(entityName: string) {
    const error = new Error(`Could not find any entity of type "${entityName}" matching the requested role`);
    error.name = "EntityNotFoundError";
    return error;
}

function createAuthenticatedRouteApp(provider: GuildRoleConnectionConfigurationProvider = getGuildRoleConnectionConfiguration) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/roles/:role_id/connections/configuration", createGuildRoleConnectionConfigurationRouter(provider));
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
    additionalProperties?: boolean | JsonSchema;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string | string[];
};

type SchemaMap = Record<string, JsonSchema>;

type OpenApi = {
    paths?: Record<
        string,
        {
            delete?: unknown;
            get?: {
                summary?: string;
                responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
                security?: unknown;
            };
            patch?: unknown;
            post?: unknown;
            put?: unknown;
        }
    >;
};

type TestingManifest = {
    entries?: {
        authMode?: string;
        id?: string;
        path?: string;
        routeMetadata?: {
            responseBodies?: string[];
            responseStatuses?: number[];
        };
        sourceFile?: string;
    }[];
};

type SourceCatalogEntry = {
    method?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};

type MissingRoutesReport = {
    missing_entries: {
        method: string;
        route: string;
        route_name?: string;
    }[];
};

type HttpContractCatalog = {
    contracts?: {
        authMode?: string;
        manifestId?: string;
        routeMetadata?: {
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SuiteCoverage = unknown;
