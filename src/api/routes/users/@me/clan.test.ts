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
import type { PrimaryGuild, UserPrivate } from "@spacebar/schemas";
import { DiscordApiErrors } from "@spacebar/util";
import express from "express";
import type { UserClanGuild, UserClanRouteDependencies, UserClanUser } from "./clan";

const requireModule = require;
const routeModulePath = require.resolve("./clan");
const manifestId = "api:http:PUT:/users/@me/clan/";

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("PUT /users/@me/clan", () => {
    test("declares authenticated guild identity metadata", (t) => {
        const harness = setupUserClanRoute(t);
        const routeOptions = harness.routeOptions[0] as {
            summary?: string;
            requestBody?: string;
            coerceRequestBody?: boolean;
            event?: string[];
            responses?: Record<number, { body?: string }>;
        };

        assert.equal(routeOptions.summary, "Set Guild Identity");
        assert.equal(routeOptions.requestBody, "UserClanModifySchema");
        assert.equal(routeOptions.coerceRequestBody, false);
        assert.deepEqual(routeOptions.event, ["USER_UPDATE", "GUILD_MEMBER_UPDATE"]);
        assert.equal(routeOptions.responses?.[200]?.body, "APIPrivateUser");
        assert.equal(routeOptions.responses?.[400]?.body, "APIErrorResponse");
        assert.equal(routeOptions.responses?.[401]?.body, "APIErrorResponse");
        assert.equal(routeOptions.responses?.[404]?.body, "APIErrorResponse");
    });

    test("builds primary guild identity from the current member guild", () => {
        const routeModule = requireModule(routeModulePath) as typeof import("./clan");

        assert.deepEqual(routeModule.buildPrimaryGuildIdentity({ identity_guild_id: "111" }, null, { id: "111", profile_tag: "SB" }), {
            identity_enabled: true,
            identity_guild_id: "111",
            tag: "SB",
            badge: null,
        });
        assert.deepEqual(routeModule.buildPrimaryGuildIdentity({ identity_enabled: null, identity_guild_id: "111" }, null, { id: "111", profile_tag: "SB" }), {
            identity_enabled: null,
            identity_guild_id: "111",
            tag: null,
            badge: null,
        });
        assert.deepEqual(routeModule.buildPrimaryGuildIdentity({ identity_enabled: false }, null), {
            identity_enabled: false,
            identity_guild_id: null,
            tag: null,
            badge: null,
        });
        assert.equal(routeModule.buildPrimaryGuildIdentity({ identity_guild_id: null }, { identity_enabled: true, identity_guild_id: "111", tag: "SB", badge: null }), null);
    });

    test("fails closed when enabling without a guild", () => {
        const routeModule = requireModule(routeModulePath) as typeof import("./clan");

        assert.throws(
            () => routeModule.buildPrimaryGuildIdentity({ identity_enabled: true }, null),
            (error) => error === DiscordApiErrors.INVALID_FORM_BODY,
        );
    });

    test("persists the selected clan identity and emits user update events", async (t) => {
        const user = createClanUser();
        const harness = setupUserClanRoute(t, {
            user,
            guilds: new Map([["111", { id: "111", profile_tag: "SB" }]]),
        });

        const response = await requestJson(harness.app, "/users/@me/clan", { identity_enabled: true, identity_guild_id: "111" });

        assert.equal(response.status, 200);
        assert.deepEqual(harness.calls.findUsers, ["viewer"]);
        assert.deepEqual(harness.calls.guildLookups, [{ userId: "viewer", guildId: "111" }]);
        assert.equal(harness.calls.saves, 1);
        assert.equal(harness.calls.emits, 1);
        assert.deepEqual(user.primary_guild, {
            identity_enabled: true,
            identity_guild_id: "111",
            tag: "SB",
            badge: null,
        });
        assert.deepEqual((response.body as UserPrivate).primary_guild, user.primary_guild);
    });

    test("generated artifacts include only the assigned PUT user clan route", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "users", "@me", "clan.ts"), "utf8");
        const schemas = readJson<
            Record<
                string,
                {
                    type?: string;
                    properties?: Record<string, { type?: string | string[]; pattern?: string }>;
                }
            >
        >(path.join("assets", "schemas.json"));
        const openapi = readJson<{
            paths?: Record<
                string,
                {
                    put?: {
                        requestBody?: { content?: { "application/json"?: { schema?: { $ref?: string } } } };
                        responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
                        security?: unknown;
                    };
                    get?: unknown;
                    post?: unknown;
                    delete?: unknown;
                }
            >;
        }>(path.join("assets", "openapi.json"));
        const sourceCatalog = readJson<
            {
                method?: string;
                route?: string;
                route_name?: string;
                source?: string;
                request_schema_ref?: string;
                response_schema_refs?: string[];
            }[]
        >(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<{ missing_entries?: { method?: string; route?: string; route_name?: string }[] }>(path.join("packages", "missing-routes", "missing.json"));
        const manifest = readJson<{
            entries?: {
                id?: string;
                authMode?: string;
                sourceFile?: string;
                routeMetadata?: {
                    requestBody?: string;
                    event?: string[];
                    responseBodies?: string[];
                    responseStatuses?: number[];
                };
            }[];
        }>(path.join("assets", "testing-manifest.json"));
        const contractMatrix = readJson<{ contracts?: { manifestId?: string }[] }>(path.join("test", "generated", "http-contracts.json"));
        const suiteCoverage = readJson<{ groups?: { suites?: { manifestIds?: string[] }[] }[] }>(path.join("test", "generated", "suite-coverage.json"));

        assert.match(routeSource, /router\.put\(\s*["']\/["']/);
        assert.doesNotMatch(routeSource, /router\.(get|post|delete|patch)\(/);
        assert.equal(schemas.UserClanModifySchema?.properties?.identity_enabled?.type?.includes("boolean"), true);
        assert.equal(schemas.UserClanModifySchema?.properties?.identity_enabled?.type?.includes("null"), true);
        assert.equal(schemas.UserClanModifySchema?.properties?.identity_guild_id?.pattern, "^\\d{1,20}$");

        const operation = openapi.paths?.["/users/@me/clan/"]?.put;
        assert.ok(operation, "expected generated OpenAPI operation");
        assert.deepEqual(operation.security, [{ bearer: [] }]);
        assert.equal(operation.requestBody?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/UserClanModifySchema");
        assert.equal(operation.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIPrivateUser");
        assert.equal(operation.responses?.["400"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(openapi.paths?.["/users/@me/clan/"]?.get, undefined);
        assert.equal(openapi.paths?.["/users/@me/clan/"]?.post, undefined);
        assert.equal(openapi.paths?.["/users/@me/clan/"]?.delete, undefined);

        const sourceRoute = sourceCatalog.find((entry) => entry.method === "PUT" && entry.route === "/users/@me/clan");
        assert.equal(sourceRoute?.route_name, "PUT_USERS__ME_CLAN");
        assert.equal(sourceRoute?.source, "src/api/routes/users/@me/clan.ts");
        assert.equal(sourceRoute?.request_schema_ref, "UserClanModifySchema");
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIPrivateUser"), true);
        assert.equal(sourceRoute?.response_schema_refs?.includes("APIErrorResponse"), true);

        assert.equal(
            missingRoutes.missing_entries?.some((entry) => entry.method === "PUT" && entry.route === "/users/@me/clan" && entry.route_name === "PUT_USERS__ME_CLAN"),
            false,
        );

        const manifestEntry = manifest.entries?.find((entry) => entry.id === manifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/users/@me/clan.ts");
        assert.equal(manifestEntry?.routeMetadata?.requestBody, "UserClanModifySchema");
        assert.deepEqual(manifestEntry?.routeMetadata?.event, ["USER_UPDATE", "GUILD_MEMBER_UPDATE"]);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIPrivateUser"), true);
        assert.equal(manifestEntry?.routeMetadata?.responseBodies?.includes("APIErrorResponse"), true);
        assert.deepEqual(manifestEntry?.routeMetadata?.responseStatuses, [200, 400, 401, 404]);

        assert.equal(
            contractMatrix.contracts?.some((contract) => contract.manifestId === manifestId),
            true,
        );
        assert.equal(
            suiteCoverage.groups?.some((group) => group.suites?.some((suite) => suite.manifestIds?.includes(manifestId))),
            true,
        );
    });
});

type HarnessOptions = {
    user?: UserClanUser;
    guilds?: Map<string, UserClanGuild>;
};

function setupUserClanRoute(t: TestContext, options: HarnessOptions = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const routeOptions: unknown[] = [];
    const calls = {
        findUsers: [] as string[],
        guildLookups: [] as { userId: string; guildId: string }[],
        saves: 0,
        emits: 0,
    };
    const user = options.user ?? createClanUser();
    const guilds = options.guilds ?? new Map<string, UserClanGuild>();
    const dependencies: UserClanRouteDependencies = {
        async findCurrentUser(userId) {
            calls.findUsers.push(userId);
            return user;
        },
        async findCurrentUserGuild(userId, guildId) {
            calls.guildLookups.push({ userId, guildId });
            const guild = guilds.get(guildId);
            if (!guild) throw DiscordApiErrors.UNKNOWN_GUILD;

            return guild;
        },
        async saveCurrentUser() {
            calls.saves += 1;
        },
        async emitCurrentUserUpdateEvents() {
            calls.emits += 1;
        },
    };

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    const routeModule = requireModule(routeModulePath) as typeof import("./clan");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/users/@me/clan", routeModule.createUserClanRouter(dependencies));

    return {
        app,
        calls,
        get routeOptions() {
            return routeOptions;
        },
    };
}

function createClanUser(primaryGuild: PrimaryGuild | null = null): UserClanUser {
    const user = {
        id: "viewer",
        primary_guild: primaryGuild,
        async save() {
            return user;
        },
        toPublicUser() {
            return {
                id: user.id,
                username: "viewer",
                discriminator: "0001",
                avatar: null,
                public_flags: 0,
                primary_guild: user.primary_guild,
            };
        },
        toPrivateUser() {
            return {
                ...user.toPublicUser(),
                flags: 0,
                mfa_enabled: false,
                email: "viewer@example.com",
                verified: true,
                nsfw_allowed: true,
                premium: false,
                premium_type: 0,
                purchased_flags: 0,
                premium_usage_flags: 0,
                disabled: false,
            };
        },
    };

    return user as unknown as UserClanUser;
}

async function requestJson(app: express.Express, requestPath: string, body: unknown): Promise<{ status: number; body: unknown }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });

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

function readJson<T>(filePath: string): T {
    return JSON.parse(readFileSync(path.join(process.cwd(), filePath), "utf8")) as T;
}
