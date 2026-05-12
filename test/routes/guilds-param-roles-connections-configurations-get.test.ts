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
    createGuildRoleConnectionsConfigurationsRouter,
    getGuildRoleConnectionsConfigurations,
    type GuildRoleConnectionsConfigurationsProvider,
} from "../../src/api/routes/guilds/#guild_id/roles/connections-configurations";
import { nonCoercingAjv, validateSchema } from "../../src/schemas/Validator";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const requireModule = require;
const coveredManifestId = "api:http:GET:/guilds/:guild_id/roles/connections-configurations/";
const assignedPath = "/guilds/{guild_id}/roles/connections-configurations";
const assignedMissingPath = "/guilds/{param}/roles/connections-configurations";
const assignedRouteName = "GET_GUILDS_GUILD_ID_ROLES_CONNECTIONS_CONFIGURATIONS";
const guildId = "100000000000000001";

describe("GET /guilds/:guild_id/roles/connections-configurations", () => {
    test("declares the assigned manifest route id and stays behind bearer auth", async () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/roles/connections-configurations/");
        assert.equal(isNoAuthorizationRoute("GET", `/guilds/${guildId}/roles/connections-configurations`), false);
        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/roles/connections-configurations`), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/roles/connections-configurations", createGuildRoleConnectionsConfigurationsRouter());
        app.use(ErrorHandler);

        const response = await requestJson(app, `/guilds/${guildId}/roles/connections-configurations`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
    });

    test("requires guild membership and returns the locally backed configuration list", async (t) => {
        const memberLookups: unknown[] = [];
        mockMembership(t, true, memberLookups);

        let providerGuildId: string | undefined;
        const provider: GuildRoleConnectionsConfigurationsProvider = (currentGuildId) => {
            providerGuildId = currentGuildId;
            return [createConfigurationRule()];
        };

        const response = await requestJson(createAuthenticatedRouteApp(provider), `/guilds/${guildId}/roles/connections-configurations`);

        assert.equal(response.status, 200);
        assert.equal(providerGuildId, guildId);
        assert.deepEqual(memberLookups, [
            {
                where: { id: "viewer", guild_id: guildId },
            },
        ]);
        assert.deepEqual(response.body, [createConfigurationRule()]);
    });

    test("returns 403 when the authenticated user is not a guild member", async (t) => {
        mockMembership(t, false);

        const response = await requestJson(createAuthenticatedRouteApp(), `/guilds/${guildId}/roles/connections-configurations`);

        assert.equal(response.status, 403);
        assert.match((response.body as { message?: string }).message ?? "", /not member of this guild/);
    });

    test("does not fabricate linked-role configuration state without durable local backing", () => {
        const first = getGuildRoleConnectionsConfigurations(guildId);
        const second = getGuildRoleConnectionsConfigurations(guildId);

        assert.deepEqual(first, []);
        assert.deepEqual(second, []);
        assert.notEqual(first, second, "callers should receive a fresh response array");
    });

    test("validates the documented guild role connection configurations response shape", () => {
        const payload = [createConfigurationRule()];
        const validateWithoutCoercion = nonCoercingAjv.getSchema("GuildRoleConnectionsConfigurationsResponse");

        assert.deepEqual(validateSchema("GuildRoleConnectionsConfigurationsResponse", payload), payload);
        assert.ok(validateWithoutCoercion, "GuildRoleConnectionsConfigurationsResponse should be registered with the non-coercing validator");
        assert.equal(validateWithoutCoercion(payload), true);
        assert.equal(validateWithoutCoercion([{ ...payload[0], role_id: 12345 }]), false);
        assert.equal(validateWithoutCoercion([{ ...payload[0], rules: [{ connection_type: "application" }] }]), false);
        assert.equal(validateWithoutCoercion([{ ...payload[0], applications: { [applicationId]: { id: applicationId } } }]), false);
    });

    test("declares source-backed metadata and generated artifacts for only the exact owned path", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "roles", "connections-configurations.ts"), "utf8");
        const schemas = readJson<SchemaMap>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<OpenApi>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<SuiteCoverage>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /summary:\s*"Get Guild Role Connections Configurations"/);
        assert.match(routeSource, /does not currently persist Discord linked-role configuration state/);
        assert.match(routeSource, /Member\.IsInGuildOrFail\(req\.user_id, guildId\)/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildRoleConnectionsConfigurationsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /router\.(?:delete|patch|put|post)\(/);
        assert.doesNotMatch(routeSource, /connections\/configuration|connections\/eligibility|connections\/assign|connections\/unassign/);

        assert.equal(schemas.GuildRoleConnectionsConfigurationsResponse.type, "array");
        assert.equal(schemas.GuildRoleConnectionsConfigurationsResponse.items?.$ref, "#/definitions/GuildRoleConnectionRuleResponse");
        assert.deepEqual(schemas.GuildRoleConnectionRuleResponse.required?.sort(), ["applications", "role_id", "rules"]);
        assert.equal(schemas.GuildRoleConnectionRuleResponse.properties?.role_id?.type, "string");
        assert.equal(schemas.GuildRoleConnectionRuleResponse.properties?.rules?.type, "array");
        assert.equal(schemas.GuildRoleConnectionRuleResponse.properties?.rules?.items?.type, "array");
        assert.equal(schemas.GuildRoleConnectionRuleResponse.properties?.rules?.items?.items?.$ref, "#/definitions/GuildRoleConnectionRequirementResponse");
        assert.equal(schemas.GuildRoleConnectionRuleResponse.properties?.applications?.$ref, "#/definitions/GuildRoleConnectionRuleApplicationsResponse");

        const route = openapi.paths?.["/guilds/{guild_id}/roles/connections-configurations/"]?.get;
        assert.equal(route?.summary, "Get Guild Role Connections Configurations");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildRoleConnectionsConfigurationsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/roles/connections-configurations/"]?.delete, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/roles/connections-configurations/"]?.patch, undefined);
        assert.equal(openapi.paths?.["/guilds/{guild_id}/roles/{role_id}/connections/configuration/"]?.get, undefined);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.path, "/guilds/:guild_id/roles/connections-configurations/");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/roles/connections-configurations.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "GuildRoleConnectionsConfigurationsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === assignedPath);
        assert.equal(catalogEntry?.route_name, assignedRouteName);
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/roles/connections-configurations.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildRoleConnectionsConfigurationsResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "GuildRoleConnectionsConfigurationsResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403],
        );
        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === assignedMissingPath && entry.route_name === assignedRouteName),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "DELETE" && entry.route === assignedMissingPath),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PATCH" && entry.route === assignedMissingPath),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/roles/{param}/connections/configuration"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/roles/{param}/connections/eligibility"),
            true,
        );
    });
});

const applicationId = "100000000000000099";

function createConfigurationRule() {
    return {
        role_id: "100000000000000002",
        rules: [
            [
                {
                    connection_type: "application",
                    connection_metadata_field: "level",
                    operator: 2,
                    value: "10",
                    application_id: applicationId,
                },
            ],
        ],
        applications: {
            [applicationId]: createIntegrationApplication(),
        },
    };
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

function mockMembership(t: TestContext, isMember: boolean, memberLookups: unknown[] = []) {
    const util = requireModule("@spacebar/util") as typeof import("../../src/util");

    t.mock.method(util.Member, "count", async (findOptions: unknown) => {
        memberLookups.push(findOptions);
        return isMember ? 1 : 0;
    });
}

function createAuthenticatedRouteApp(provider: GuildRoleConnectionsConfigurationsProvider = getGuildRoleConnectionsConfigurations) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/roles/connections-configurations", createGuildRoleConnectionsConfigurationsRouter(provider));
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
        }
    >;
};

type TestingManifest = {
    entries?: {
        id?: string;
        authMode?: string;
        path?: string;
        sourceFile?: string;
        routeMetadata?: {
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
        route_name?: string;
    }[];
};

type HttpContractCatalog = {
    contracts?: {
        manifestId?: string;
        authMode?: string;
        routeMetadata?: {
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};

type SuiteCoverage = unknown;
