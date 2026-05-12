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
import creatorMonetizationMarketingOnboardingRouter, {
    CREATOR_MONETIZATION_MARKETING_ONBOARDING_UNSUPPORTED_MESSAGE,
    createCreatorMonetizationMarketingOnboardingRouter,
    getCreatorMonetizationMarketingOnboarding,
    type CreatorMonetizationMarketingOnboardingRepositories,
} from "../../src/api/routes/guilds/#guild_id/creator-monetization/marketing/onboarding";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const requireModule = require;
const coveredManifestId = "api:http:GET:/guilds/:guild_id/creator-monetization/marketing/onboarding/";

describe("GET /guilds/:guild_id/creator-monetization/marketing/onboarding", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(coveredManifestId, "api:http:GET:/guilds/:guild_id/creator-monetization/marketing/onboarding/");
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/guilds/100000000000000001/creator-monetization/marketing/onboarding"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/guilds/100000000000000001/creator-monetization/marketing/onboarding"), false);

        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/creator-monetization/marketing/onboarding", creatorMonetizationMarketingOnboardingRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/guilds/100000000000000001/creator-monetization/marketing/onboarding");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("requires MANAGE_GUILD, checks guild existence, and fails closed for authorized users", async (t) => {
        const permissionLookups: unknown[][] = [];
        const guildLookups: unknown[] = [];
        mockPermissions(t, true, permissionLookups);

        const repositories = {
            guildRepository: {
                findOneOrFail: t.mock.fn(async (findOptions: unknown) => {
                    guildLookups.push(findOptions);
                    return { id: "100000000000000001" };
                }),
            },
        };

        const app = createAuthenticatedRouteApp(repositories);
        const response = await requestJson(app, "/guilds/100000000000000001/creator-monetization/marketing/onboarding");

        assert.equal(response.status, 501);
        assert.deepEqual(response.body, {
            code: 0,
            message: CREATOR_MONETIZATION_MARKETING_ONBOARDING_UNSUPPORTED_MESSAGE,
        });
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
        const guildLookups: unknown[] = [];

        const app = createAuthenticatedRouteApp({
            guildRepository: {
                findOneOrFail: t.mock.fn(async (findOptions: unknown) => {
                    guildLookups.push(findOptions);
                    return { id: "100000000000000001" };
                }),
            },
        });
        const response = await requestJson(app, "/guilds/100000000000000001/creator-monetization/marketing/onboarding");

        assert.equal(response.status, 403);
        assert.equal((response.body as { code?: unknown }).code, 50013);
        assert.deepEqual(guildLookups, []);
    });

    test("uses the existing not-found behavior when the guild does not exist", async (t) => {
        const findOptions = {
            where: { id: "missing-guild" },
            select: { id: true },
        };
        const repository = {
            findOneOrFail: t.mock.fn(async () => {
                const { EntityNotFoundError } = await import("typeorm");
                throw new EntityNotFoundError("Guild", findOptions.where);
            }),
        };

        await assert.rejects(() => getCreatorMonetizationMarketingOnboarding("missing-guild", { guildRepository: repository }), {
            name: "EntityNotFoundError",
        });
    });

    test("declares source-backed route metadata in source and generated artifacts", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "creator-monetization", "marketing", "onboarding.ts"), "utf8");
        const openapi = readJson<OpenApi>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /summary:\s*"Get Creator Monetization Marketing Onboarding"/);
        assert.match(routeSource, /provider-backed creator monetization state and marketing onboarding progress/);
        assert.match(routeSource, /permission:\s*"MANAGE_GUILD"/);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /403:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /501:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.doesNotMatch(routeSource, /creator-monetization\/requirements/);
        assert.doesNotMatch(routeSource, /creator-monetization\/restrictions/);
        assert.doesNotMatch(routeSource, /200:\s*\{/);

        const route = openapi.paths?.["/guilds/{guild_id}/creator-monetization/marketing/onboarding/"]?.get;
        assert.equal(route?.summary, "Get Creator Monetization Marketing Onboarding");
        assert.equal(route?.["x-permission-required"], "MANAGE_GUILD");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["501"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/creator-monetization/marketing/onboarding.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [401, 403, 404, 501],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/creator-monetization/marketing/onboarding");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_CREATOR_MONETIZATION_MARKETING_ONBOARDING");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/creator-monetization/marketing/onboarding.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["APIErrorResponse"]);

        const contract = contracts.contracts?.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.equal(contract?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [401, 403, 404, 501],
        );

        assert.equal(JSON.stringify(suiteCoverage).includes(coveredManifestId), true);
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/creator-monetization/marketing/onboarding"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.route === "/guilds/{param}/creator-monetization/requirements"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.route === "/guilds/{param}/creator-monetization/restrictions"),
            true,
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

function createAuthenticatedRouteApp(repositories: CreatorMonetizationMarketingOnboardingRepositories) {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/creator-monetization/marketing/onboarding", createCreatorMonetizationMarketingOnboardingRouter(repositories));
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
