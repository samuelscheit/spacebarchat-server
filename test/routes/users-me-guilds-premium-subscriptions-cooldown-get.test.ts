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
import { describe, test } from "node:test";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "@spacebar/api";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import cooldownRouter, { getPremiumGuildSubscriptionCooldown } from "../../src/api/routes/users/@me/guilds/premium/subscriptions/cooldown";

process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

const manifestId = "api:http:GET:/users/@me/guilds/premium/subscriptions/cooldown/";

describe("GET /users/@me/guilds/premium/subscriptions/cooldown", () => {
    test("declares the assigned manifest route id", () => {
        assert.equal(manifestId, "api:http:GET:/users/@me/guilds/premium/subscriptions/cooldown/");
    });

    test("stays behind bearer authentication", async () => {
        assert.equal(isNoAuthorizationRoute("GET", "/users/@me/guilds/premium/subscriptions/cooldown"), false);
        assert.equal(isNoAuthorizationRoute("GET", "/api/v9/users/@me/guilds/premium/subscriptions/cooldown"), false);

        const app = express();
        app.use(Authentication);
        app.use("/users/@me/guilds/premium/subscriptions/cooldown", cooldownRouter);
        app.use(ErrorHandler);

        const response = await requestJson(app, "/users/@me/guilds/premium/subscriptions/cooldown");

        assert.equal(response.status, 401);
        assert.equal((response.body as { code?: unknown }).code, 401);
    });

    test("fails closed with the source-backed unknown cooldown error instead of fabricating cooldown state", async () => {
        assert.throws(() => getPremiumGuildSubscriptionCooldown("viewer"), {
            code: DiscordApiErrors.UNKNOWN_PREMIUM_SERVER_SUBSCRIBE_COOLDOWN.code,
            message: DiscordApiErrors.UNKNOWN_PREMIUM_SERVER_SUBSCRIBE_COOLDOWN.message,
            httpStatus: DiscordApiErrors.UNKNOWN_PREMIUM_SERVER_SUBSCRIBE_COOLDOWN.httpStatus,
        });

        const app = createAuthenticatedApp();
        const response = await requestJson(app, "/users/@me/guilds/premium/subscriptions/cooldown");

        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            code: 10050,
            message: "Unknown premium server subscribe cooldown",
        });
    });

    test("declares fail-closed route metadata and leaves adjacent premium subscription routes untouched", () => {
        const routeSource = readFileSync(join(process.cwd(), "src", "api", "routes", "users", "@me", "guilds", "premium", "subscriptions", "cooldown.ts"), "utf8");
        const schemas = readJson<SchemaMap>(join(process.cwd(), "assets", "schemas.json"));
        const openapi = readJson<OpenApi>(join(process.cwd(), "assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(join(process.cwd(), "assets", "testing-manifest.json"));
        const sourceCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const userdoccersCatalog = readJson<SourceCatalogEntry[]>(
            join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.userdoccers.catalog.json"),
        );
        const xhyromCatalog = readJson<SourceCatalogEntry[]>(join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.xhyrom.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(join(process.cwd(), "packages", "missing-routes", "missing.json"));
        const contracts = readJson<HttpContractCatalog>(join(process.cwd(), "test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<unknown>(join(process.cwd(), "test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /summary:\s*"Get Premium Guild Subscription Cooldown"/);
        assert.match(routeSource, /fails closed instead of fabricating cooldown limits or timestamps/);
        assert.match(routeSource, /UNKNOWN_PREMIUM_SERVER_SUBSCRIBE_COOLDOWN/);
        assert.doesNotMatch(routeSource, /router\.(?:post|put|patch|delete)\(/);
        assert.doesNotMatch(routeSource, /subscription-slots|cancel|uncancel|billing|entitlement|referral|Nitro/);
        assert.doesNotMatch(routeSource, /200:\s*\{/);
        assert.match(routeSource, /400:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);

        assert.ok(schemas.APIErrorResponse, "APIErrorResponse schema should remain available");

        const route = openapi.paths?.["/users/@me/guilds/premium/subscriptions/cooldown/"]?.get;
        assert.equal(route?.summary, "Get Premium Guild Subscription Cooldown");
        assert.equal(route?.responses?.["200"], undefined);
        assert.equal(route?.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(route?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(route?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/guilds/premium/subscriptions/cooldown.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies, ["APIErrorResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [400, 401],
        );

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/guilds/premium/subscriptions/cooldown");
        assert.equal(catalogEntry?.route_name, "GET_USERS__ME_GUILDS_PREMIUM_SUBSCRIPTIONS_COOLDOWN");
        assert.equal(catalogEntry?.source, "src/api/routes/users/@me/guilds/premium/subscriptions/cooldown.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs, ["APIErrorResponse"]);

        const userdoccersEntry = userdoccersCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/guilds/premium/subscriptions/cooldown");
        assert.equal(userdoccersEntry?.source, "userdoccers:resources/subscription.mdx");
        assert.equal(userdoccersEntry?.summary, "Get Premium Guild Subscription Cooldown");
        const xhyromEntry = xhyromCatalog.find((entry) => entry.method === "GET" && entry.route === "/users/@me/guilds/premium/subscriptions/cooldown");
        assert.equal(xhyromEntry?.route_name, "APPLIED_GUILD_BOOST_COOLDOWN");

        const contract = contracts.contracts?.find((entry) => entry.manifestId === manifestId);
        assert.equal(contract?.authMode, "bearer");
        assert.deepEqual(contract?.routeMetadata?.responses, ["APIErrorResponse"]);
        assert.deepEqual(
            contract?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [400, 401],
        );

        assert.equal(JSON.stringify(suiteCoverage).includes(manifestId), true);
        assert.equal(hasMissingRoute(missingRoutes, "GET", "/users/@me/guilds/premium/subscriptions/cooldown"), false);
        assert.equal(hasMissingRoute(missingRoutes, "GET", "/users/@me/guilds/premium/subscriptions"), true);
        assert.equal(hasMissingRoute(missingRoutes, "POST", "/users/@me/guilds/premium/subscription-slots/{param}/cancel"), true);
        assert.equal(hasMissingRoute(missingRoutes, "POST", "/users/@me/guilds/premium/subscription-slots/{param}/uncancel"), true);
        assert.equal(hasMissingRoute(missingRoutes, "DELETE", "/guilds/{param}/premium/subscriptions/{param}"), true);
    });
});

function createAuthenticatedApp() {
    const app = express();

    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/guilds/premium/subscriptions/cooldown", cooldownRouter);
    app.use(ErrorHandler);

    return app;
}

function requestJson(app: express.Express, route: string) {
    return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const server = app.listen(0, "127.0.0.1", async () => {
            try {
                const port = (server.address() as AddressInfo).port;
                const response = await fetch(`http://127.0.0.1:${port}${route}`);
                const bodyText = await response.text();
                resolve({
                    status: response.status,
                    body: bodyText ? JSON.parse(bodyText) : undefined,
                });
            } catch (error) {
                reject(error);
            } finally {
                await close(server);
            }
        });
    });
}

function close(server: Server) {
    return new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function hasMissingRoute(report: MissingRoutesReport, method: string, route: string) {
    return report.missing_entries?.some((entry) => entry.method === method && entry.route === route) ?? false;
}

type SchemaMap = Record<string, unknown>;

type OpenApi = {
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
    summary?: string;
    response_schema_refs?: string[];
};

type MissingRoutesReport = {
    missing_entries?: {
        method?: string;
        route?: string;
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
