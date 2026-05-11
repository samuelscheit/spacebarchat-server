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
import allowedApplicationsRouter, { buildGuildOnboardingAllowedApplicationsResponse } from "../../src/api/routes/guilds/#guild_id/onboarding/allowed-applications";
import { nonCoercingAjv, validateSchema } from "../../src/schemas/Validator";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const requireModule = require;
const coveredManifestId = "api:http:GET:/guilds/:guild_id/onboarding/allowed-applications/";

describe("GET /guilds/:guild_id/onboarding/allowed-applications", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/onboarding/allowed-applications/");
    });

    test("builds a source-compatible empty allowed applications response without shared mutable state", () => {
        const first = buildGuildOnboardingAllowedApplicationsResponse();
        first.application_ids.push("100000000000000001");

        assert.deepEqual(buildGuildOnboardingAllowedApplicationsResponse(), { application_ids: [] });
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/guilds/100000000000000001/onboarding/allowed-applications"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/guilds/100000000000000001/onboarding/allowed-applications"), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/onboarding/allowed-applications", allowedApplicationsRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/guilds/100000000000000001/onboarding/allowed-applications");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("requires MANAGE_GUILD, checks guild existence, and returns the fail-closed local allowlist", async (t) => {
        const permissionLookups: unknown[][] = [];
        const guildLookups: unknown[] = [];
        mockPermissions(t, true, permissionLookups);
        mockGuildLookup(t, guildLookups);

        const app = createAuthenticatedRouteApp();
        const response = await requestJson(app, "/guilds/100000000000000001/onboarding/allowed-applications");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { application_ids: [] });
        assert.deepEqual(permissionLookups, [["viewer", "100000000000000001", undefined]]);
        assert.deepEqual(guildLookups, [
            {
                where: { id: "100000000000000001" },
                select: { id: true },
            },
        ]);
    });

    test("returns 403 when the authenticated user lacks MANAGE_GUILD", async (t) => {
        mockPermissions(t, false);
        mockGuildLookup(t, []);

        const app = createAuthenticatedRouteApp();
        const response = await requestJson(app, "/guilds/100000000000000001/onboarding/allowed-applications");

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 50013);
    });

    test("validates the documented allowed applications response shape", () => {
        const payload = { application_ids: ["100000000000000001", "100000000000000002"] };
        const validateWithoutCoercion = nonCoercingAjv.getSchema("GuildOnboardingAllowedApplicationsResponse");

        assert.deepEqual(validateSchema("GuildOnboardingAllowedApplicationsResponse", payload), payload);
        assert.ok(validateWithoutCoercion, "GuildOnboardingAllowedApplicationsResponse should be registered with the non-coercing validator");
        assert.equal(validateWithoutCoercion(payload), true);
        assert.equal(validateWithoutCoercion({ application_ids: [123] }), false);
        assert.equal(validateWithoutCoercion({ applications: [] }), false);
    });

    test("declares source-backed route metadata in source and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "onboarding", "allowed-applications.ts"), "utf8");
        const schemas = readJson<SchemaMap>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<OpenApi>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join(process.cwd(), "test", "generated", "http-contracts.json"));

        assert.match(routeSource, /summary:\s*"Get Guild Onboarding Allowed Applications"/);
        assert.match(routeSource, /onboarding connection allowlist/);
        assert.match(routeSource, /permission:\s*"MANAGE_GUILD"/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"GuildOnboardingAllowedApplicationsResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.equal(schemas.GuildOnboardingAllowedApplicationsResponse.type, "object");
        assert.deepEqual(schemas.GuildOnboardingAllowedApplicationsResponse.required, ["application_ids"]);
        assert.equal(schemas.GuildOnboardingAllowedApplicationsResponse.properties?.application_ids?.type, "array");
        assert.equal(schemas.GuildOnboardingAllowedApplicationsResponse.properties?.application_ids?.items?.type, "string");

        const route = openapi.paths?.["/guilds/{guild_id}/onboarding/allowed-applications/"]?.get;
        assert.equal(route?.summary, "Get Guild Onboarding Allowed Applications");
        assert.equal(route?.["x-permission-required"], "MANAGE_GUILD");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildOnboardingAllowedApplicationsResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/onboarding/allowed-applications.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "GuildOnboardingAllowedApplicationsResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/onboarding/allowed-applications");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_ONBOARDING_ALLOWED_APPLICATIONS");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/onboarding/allowed-applications.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "GuildOnboardingAllowedApplicationsResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.equal(contract?.routeMetadata?.responses?.includes("GuildOnboardingAllowedApplicationsResponse"), true);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 403, 404],
        );

        assert.equal(missingRoutes.routes.includes("/guilds/{param}/onboarding/allowed-applications"), false);
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/onboarding/allowed-applications"),
            false,
        );
    });
});

function mockPermissions(t: TestContext, hasManageGuild: boolean, permissionLookups: unknown[][] = []) {
    const permissionsModule = requireModule(join(process.cwd(), "dist", "util", "util", "Permissions.js")) as typeof import("../../src/util/util/Permissions");

    t.mock.method(permissionsModule, "getPermission", async (...args: unknown[]) => {
        permissionLookups.push(args);
        return {
            has: () => hasManageGuild,
        } as never;
    });
}

function mockGuildLookup(t: TestContext, guildLookups: unknown[]) {
    const util = requireModule("@spacebar/util") as typeof import("../../src/util");

    t.mock.method(util.Guild, "findOneOrFail", async (findOptions: unknown) => {
        guildLookups.push(findOptions);
        return { id: "100000000000000001" };
    });
}

function createAuthenticatedRouteApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/onboarding/allowed-applications", allowedApplicationsRouter);
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
    type?: string;
    items?: { $ref?: string; type?: string };
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
            permission?: string;
            responses?: string[];
            responseStatuses?: number[];
        };
    }[];
};
