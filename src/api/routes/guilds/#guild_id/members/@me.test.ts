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
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express from "express";
import { EntityNotFoundError } from "typeorm";
import { Authentication, ErrorHandler, isNoAuthorizationRoute } from "../../../../middlewares";
import { requestJson } from "../../../../tests/helpers/UserRouteTestHelpers";

const requireModule = require;
const routeModulePath = require.resolve("./@me");
const currentMemberModulePath = require.resolve("../../../../util/utility/CurrentGuildMember");

const guildId = "200000000000000002";
const userId = "100000000000000001";
const coveredManifestId = "api:http:GET:/guilds/:guild_id/members/@me/";

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/members/@me", () => {
    test("stays behind bearer authentication", async (t) => {
        const findCurrentGuildMember = mockCurrentMemberLookup(t);
        const app = express();
        app.use(Authentication);
        app.use("/guilds/:guild_id/members/@me", loadRouteModule().default);
        app.use(ErrorHandler);

        assert.equal(isNoAuthorizationRoute("GET", `/api/v9/guilds/${guildId}/members/@me`), false);

        const response = await requestJson(app, `/guilds/${guildId}/members/@me`);

        assert.equal(response.status, 401);
        assert.match((response.body as { message?: string }).message ?? "", /Missing Authorization Header/);
        assert.equal(findCurrentGuildMember.mock.callCount(), 0);
    });

    test("returns the authenticated user's current guild member projection", async (t) => {
        const responseBody = currentMemberBody();
        const findCurrentGuildMember = mockCurrentMemberLookup(t, responseBody);

        const response = await requestJson(createApp(), `/guilds/${guildId}/members/@me`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, responseBody);
        assert.deepEqual(findCurrentGuildMember.mock.calls[0].arguments, [userId, guildId]);
    });

    test("returns a missing-member response when the authenticated user is not in the guild", async (t) => {
        const findCurrentGuildMember = mockCurrentMemberLookup(t, new EntityNotFoundError("Member", { id: userId, guild_id: guildId }));

        const response = await requestJson(createApp(), `/guilds/${guildId}/members/@me`);

        assert.equal(response.status, 404);
        assert.match((response.body as { message?: string }).message ?? "", /Member could not be found/);
        assert.deepEqual(findCurrentGuildMember.mock.calls[0].arguments, [userId, guildId]);
    });

    test("declares current-member metadata and generated route artifacts", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "guilds", "#guild_id", "members", "@me.ts"), "utf8");
        const openapi = readJson<OpenApiDocument>(path.join("assets", "openapi.json"));
        const manifest = readJson<TestingManifest>(path.join("assets", "testing-manifest.json"));
        const contracts = readJson<HttpContractCatalog>(path.join("test", "generated", "http-contracts.json"));
        const sourceCatalog = readJson<SourceRouteCatalogEntry[]>(path.join("packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json"));
        const missingRoutes = readJson<MissingRoutesReport>(path.join("packages", "missing-routes", "missing.json"));

        assert.match(routeSource, /router\.get\(\s*["']\/["']/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"CurrentGuildMemberResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /findCurrentGuildMember\(req\.user_id,\s*guild_id\)/);

        const operation = openapi.paths?.["/guilds/{guild_id}/members/@me/"]?.get;
        assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/CurrentGuildMemberResponse");
        assert.equal(operation?.responses?.["401"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.equal(operation?.responses?.["404"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/APIErrorResponse");
        assert.deepEqual(operation?.security, [{ bearer: [] }]);

        const manifestEntry = manifest.entries?.find((entry) => entry.id === coveredManifestId);
        assert.equal(manifestEntry?.authMode, "bearer");
        assert.equal(manifestEntry?.sourceFile, "src/api/routes/guilds/#guild_id/members/@me.ts");
        assert.deepEqual(manifestEntry?.routeMetadata?.responseBodies?.sort(), ["APIErrorResponse", "CurrentGuildMemberResponse"]);
        assert.deepEqual(
            manifestEntry?.routeMetadata?.responseStatuses?.sort((a, b) => a - b),
            [200, 401, 404],
        );

        const contractEntry = contracts.contracts.find((entry) => entry.manifestId === coveredManifestId);
        assert.equal(contractEntry?.sourceFile, "src/api/routes/guilds/#guild_id/members/@me.ts");
        assert.deepEqual(contractEntry?.routeMetadata?.responses?.sort(), ["APIErrorResponse", "CurrentGuildMemberResponse"]);

        const catalogEntry = sourceCatalog.find((entry) => entry.method === "GET" && entry.route === "/guilds/{guild_id}/members/@me");
        assert.equal(catalogEntry?.route_name, "GET_GUILDS_GUILD_ID_MEMBERS__ME");
        assert.equal(catalogEntry?.source, "src/api/routes/guilds/#guild_id/members/@me.ts");
        assert.deepEqual(catalogEntry?.response_schema_refs?.sort(), ["APIErrorResponse", "CurrentGuildMemberResponse"]);

        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "GET" && entry.route === "/guilds/{param}/members/@me"),
            false,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PATCH" && entry.route === "/guilds/{param}/members/@me"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "PUT" && entry.route === "/guilds/{param}/members/@me"),
            true,
        );
        assert.equal(
            missingRoutes.missing_entries.some((entry) => entry.method === "DELETE" && entry.route === "/guilds/{param}/members/@me"),
            true,
        );
    });
});

function loadRouteModule(): typeof import("./@me") {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./@me");
}

function createApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as typeof req.t;
        next();
    });
    app.use("/guilds/:guild_id/members/@me", loadRouteModule().default);
    app.use(ErrorHandler);
    return app;
}

function mockCurrentMemberLookup(t: TestContext, result: CurrentMemberBody | Error = currentMemberBody()) {
    const currentMemberModule = requireModule(currentMemberModulePath) as typeof import("../../../../util/utility/CurrentGuildMember");
    return t.mock.method(currentMemberModule, "findCurrentGuildMember", async () => {
        if (result instanceof Error) throw result;
        return result;
    });
}

function currentMemberBody(): CurrentMemberBody {
    return {
        id: userId,
        guild_id: guildId,
        nick: "display name",
        roles: [guildId],
        joined_at: "2026-01-02T03:04:05.000Z",
        pending: false,
        deaf: false,
        mute: false,
        premium_since: null,
        avatar: null,
        banner: null,
        bio: "",
        theme_colors: null,
        pronouns: "",
        communication_disabled_until: null,
        avatar_decoration_data: null,
        display_name_styles: null,
        collectibles: null,
        flags: 0,
        user: {
            id: userId,
            username: "username",
            discriminator: "0001",
            public_flags: 0,
            avatar: null,
            accent_color: null,
            banner: null,
            bio: "",
            bot: false,
            premium_since: null,
            premium_type: 0,
            theme_colors: null,
            pronouns: "",
            badge_ids: [],
            avatar_decoration_data: null,
            display_name_styles: null,
            collectibles: null,
            primary_guild: null,
        },
        permissions: "8",
    };
}

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}

type CurrentMemberBody = {
    id: string;
    guild_id: string;
    nick: string | null;
    roles: string[];
    joined_at: string;
    pending: boolean;
    deaf: boolean;
    mute: boolean;
    premium_since: string | null;
    avatar: string | null;
    banner: string | null;
    bio: string;
    theme_colors: number[] | null;
    pronouns: string;
    communication_disabled_until: string | null;
    avatar_decoration_data: unknown;
    display_name_styles: unknown;
    collectibles: unknown;
    flags: number;
    user: {
        id: string;
        username: string;
        discriminator: string;
        public_flags: number;
        avatar: string | null;
        accent_color: number | null;
        banner: string | null;
        bio: string;
        bot: boolean;
        premium_since: string | null;
        premium_type: number;
        theme_colors: number[] | null;
        pronouns: string;
        badge_ids: string[];
        avatar_decoration_data: unknown;
        display_name_styles: unknown;
        collectibles: unknown;
        primary_guild: unknown;
    };
    permissions: string;
};

type OpenApiDocument = {
    paths?: Record<
        string,
        {
            get?: {
                security?: unknown;
                responses?: Record<string, { content?: { "application/json"?: { schema?: { $ref?: string } } } }>;
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

type HttpContractCatalog = {
    contracts: {
        manifestId: string;
        sourceFile?: string;
        routeMetadata?: {
            responses?: string[];
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
