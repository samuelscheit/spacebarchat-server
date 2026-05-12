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
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express from "express";
import { isNoAuthorizationRoute } from "../../../../middlewares/NoAuthorizationRoutes";

const requireModule = require;
const manifestId = "api:http:GET:/guilds/:guild_id/role-subscriptions/templates/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

const routeModulePath = distModulePath("api", "routes", "guilds", "#guild_id", "role-subscriptions", "templates.js");

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/role-subscriptions/templates", () => {
    test("declares authenticated MANAGE_GUILD metadata for listing templates", (t) => {
        const harness = setupGuildRoleSubscriptionListingTemplatesRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Guild Role Subscription Listing Templates",
            description:
                "Returns locally backed role-subscription listing templates for a guild. Spacebar does not currently persist Discord role-subscription template state, so this compatibility endpoint returns an empty list after MANAGE_GUILD access checks.",
            permission: "MANAGE_GUILD",
            responses: {
                200: {
                    body: "GuildRoleSubscriptionListingTemplatesResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
                403: {
                    body: "APIErrorResponse",
                },
                404: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("stays on the authenticated guild permission boundary", () => {
        assert.equal(isNoAuthorizationRoute("GET", "/guilds/100000000000000001/role-subscriptions/templates"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/guilds/100000000000000001/role-subscriptions/templates"), false);
    });

    test("returns an empty list until guild role-subscription templates are persisted", async (t) => {
        const harness = setupGuildRoleSubscriptionListingTemplatesRoute(t);

        const response = await requestJson(harness.app, "/guilds/100000000000000001/role-subscriptions/templates");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, []);
        assert.deepEqual(harness.routeModule.getGuildRoleSubscriptionListingTemplates("100000000000000001"), []);
    });

    test("generated artifacts cover only the assigned GET route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "role-subscriptions", "templates.ts"), "utf8");
        const schemas = readJson<Record<string, JsonSchema>>(path.join("assets", "schemas.json"));
        const openapi = readJson<OpenApiDocument>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<TestingManifest>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<HttpContracts>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<SuiteCoverage>(path.join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(?:post|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /group-listings|subscription-listings|trial|trials|products|purchase|payout|entitlement|billing|sku/i);

        assert.equal(schemas.GuildRoleSubscriptionListingTemplatesResponse?.type, "array");
        assert.deepEqual(schemas.GuildRoleSubscriptionListingTemplatesResponse?.items, {});

        const route = openapi.paths?.["/guilds/{guild_id}/role-subscriptions/templates/"]?.get;
        assert.equal(route?.summary, "Get Guild Role Subscription Listing Templates");
        assert.equal(route?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/GuildRoleSubscriptionListingTemplatesResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["403"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const getSourceRoute = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/role-subscriptions/templates");
        assert.equal(getSourceRoute?.route_name, "GET_GUILDS_GUILD_ID_ROLE_SUBSCRIPTIONS_TEMPLATES");
        assert.equal(getSourceRoute?.source, "src/api/routes/guilds/#guild_id/role-subscriptions/templates.ts");
        assert.equal(getSourceRoute?.response_schema_refs?.includes("GuildRoleSubscriptionListingTemplatesResponse"), true);
        assert.equal(getSourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/role-subscriptions/templates"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/role-subscriptions/group-listings/{param}"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/role-subscriptions/trials"),
            true,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/role-subscriptions/templates.ts");
        assert.equal(manifestEntry?.routeMetadata?.permission, "MANAGE_GUILD");
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("GuildRoleSubscriptionListingTemplatesResponse"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 401, 403, 404]);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === manifestId),
            true,
        );
        const guildsSuite = suiteCoverage.groups?.flatMap((group) => group.suites ?? []).find((suite) => suite.id === "guilds");
        assert.equal(guildsSuite?.manifestIds?.includes(manifestId), true);
    });
});

type TestHarness = {
    app: express.Express;
    routeModule: typeof import("./templates");
    routeOptions: unknown[];
};

function setupGuildRoleSubscriptionListingTemplatesRoute(t: TestContext): TestHarness {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./templates");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/guilds/:guild_id/role-subscriptions/templates", routeModule.createGuildRoleSubscriptionListingTemplatesRouter());

    return {
        app,
        routeModule,
        get routeOptions() {
            return routeOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as unknown,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8")) as T;
}

type JsonSchema = {
    type?: string;
    items?: unknown;
};

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

type SourceRouteCatalogEntry = {
    method?: string;
    response_schema_refs?: string[];
    route?: string;
    route_name?: string;
    source?: string;
};

type MissingRoutesReport = {
    missing_entries: {
        method?: string;
        route?: string;
    }[];
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

type HttpContracts = {
    contracts?: {
        manifestId?: string;
    }[];
};

type SuiteCoverage = {
    groups?: {
        suites?: {
            id?: string;
            manifestIds?: string[];
        }[];
    }[];
};
