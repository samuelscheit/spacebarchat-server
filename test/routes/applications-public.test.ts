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
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, test } from "node:test";
import express from "express";
import { ErrorHandler } from "../../src/api/middlewares/ErrorHandler";
import {
    createPublicApplicationRouter,
    getPublicApplication,
    queryBoolean,
    toPublicApplicationResponse,
    type PublicApplicationRepositories,
} from "../../src/api/routes/applications/#application_id/public";
import { DiscordApiErrors, GuildFeature } from "../../src/util";

function makeApplication(overrides: Record<string, unknown> = {}) {
    return {
        id: "100000000000000001",
        name: "Public App",
        description: "Public application description",
        icon: null,
        type: null,
        flags: 64,
        verify_key: "verify-key",
        hook: true,
        summary: "",
        integration_public: true,
        integration_require_code_grant: false,
        bot_public: true,
        bot_require_code_grant: false,
        redirect_uris: ["https://private.example/callback"],
        owner: { id: "owner" },
        team: { id: "team" },
        ...overrides,
    };
}

function makeBot() {
    return {
        id: "200000000000000001",
        username: "PublicBot",
        discriminator: "0001",
        avatar: null,
        bot: true,
        public_flags: 0,
        toPublicUser() {
            return {
                id: this.id,
                username: this.username,
                discriminator: this.discriminator,
                avatar: this.avatar,
                bot: this.bot,
                public_flags: this.public_flags,
                email: "hidden@example.com",
            };
        },
    };
}

function makeDiscoverableGuild() {
    return {
        id: "300000000000000001",
        name: "Discoverable Guild",
        icon: null,
        banner: null,
        splash: null,
        description: "Guild description",
        features: [GuildFeature.Discoverable],
        widget_enabled: true,
        welcome_screen: {
            enabled: false,
            description: "",
            welcome_channels: [],
        },
    };
}

function createApp(repositories: PublicApplicationRepositories) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/applications/:application_id/public", createPublicApplicationRouter(repositories));
    app.use(ErrorHandler);
    return app;
}

async function requestJson(app: express.Express, requestPath: string) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`);
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

describe("GET /applications/:application_id/public", () => {
    test("serializes only the supported public application fields", () => {
        const response = toPublicApplicationResponse(
            makeApplication({
                bot: makeBot(),
                guild_id: "300000000000000001",
                guild: makeDiscoverableGuild(),
                cover_image: "cover-hash",
                install_params: { scopes: ["bot"], permissions: "0" },
                terms_of_service_url: "https://example.com/terms",
                privacy_policy_url: "https://example.com/privacy",
                custom_install_url: "https://example.com/install",
            }) as never,
        ) as unknown as Record<string, unknown>;

        assert.deepEqual(response, {
            id: "100000000000000001",
            name: "Public App",
            description: "Public application description",
            icon: null,
            type: null,
            flags: 64,
            verify_key: "verify-key",
            hook: true,
            summary: "",
            bot: {
                id: "200000000000000001",
                username: "PublicBot",
                discriminator: "0001",
                avatar: null,
                bot: true,
                public_flags: 0,
            },
            bot_public: true,
            bot_require_code_grant: false,
            integration_public: true,
            integration_require_code_grant: false,
            cover_image: "cover-hash",
            install_params: { scopes: ["bot"], permissions: "0" },
            terms_of_service_url: "https://example.com/terms",
            privacy_policy_url: "https://example.com/privacy",
            guild_id: "300000000000000001",
            guild: {
                id: "300000000000000001",
                name: "Discoverable Guild",
                icon: null,
                banner: null,
                splash: null,
                description: "Guild description",
                features: [GuildFeature.Discoverable],
                widget_enabled: true,
                welcome_screen: {
                    enabled: false,
                    description: "",
                    welcome_channels: [],
                },
            },
            custom_install_url: "https://example.com/install",
        });
        assert.equal("owner" in response, false);
        assert.equal("team" in response, false);
        assert.equal("redirect_uris" in response, false);
        assert.equal((response.bot as Record<string, unknown>).email, undefined);
    });

    test("omits the guild object when the linked guild is not discoverable", () => {
        const response = toPublicApplicationResponse(
            makeApplication({
                guild_id: "300000000000000001",
                guild: {
                    ...makeDiscoverableGuild(),
                    features: [],
                },
            }) as never,
        ) as unknown as Record<string, unknown>;

        assert.equal(response.guild_id, "300000000000000001");
        assert.equal(response.guild, undefined);
    });

    test("loads the optional guild relation only when requested", async () => {
        const calls: unknown[] = [];
        const applicationRepository = {
            findOne: async (options: unknown) => {
                calls.push(options);
                return makeApplication();
            },
        };

        await getPublicApplication("100000000000000001", { withGuild: false }, { applicationRepository: applicationRepository as never });
        await getPublicApplication("100000000000000001", { withGuild: true }, { applicationRepository: applicationRepository as never });

        assert.deepEqual(calls, [
            {
                where: { id: "100000000000000001" },
                relations: {
                    bot: true,
                },
            },
            {
                where: { id: "100000000000000001" },
                relations: {
                    bot: true,
                    guild: true,
                },
            },
        ]);
    });

    test("returns 404 for an unknown application from the mounted route", async () => {
        const app = createApp({
            applicationRepository: {
                findOne: async () => null,
            },
        });

        const response = await requestJson(app, "/applications/100000000000000009/public");

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
    });

    test("returns a public application from the mounted route", async () => {
        const app = createApp({
            applicationRepository: {
                findOne: async () =>
                    makeApplication({
                        bot: makeBot(),
                    }) as never,
            },
        });

        const response = await requestJson(app, "/applications/100000000000000001/public?with_guild=1");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, toPublicApplicationResponse(makeApplication({ bot: makeBot() }) as never));
    });

    test("parses with_guild compatibility booleans", () => {
        assert.equal(queryBoolean("true"), true);
        assert.equal(queryBoolean("1"), true);
        assert.equal(queryBoolean(["true"]), true);
        assert.equal(queryBoolean("false"), false);
        assert.equal(queryBoolean(undefined), false);
    });

    test("documents bearer auth and response metadata", () => {
        const routeSource = readFileSync(path.join(process.cwd(), "src", "api", "routes", "applications", "#application_id", "public.ts"), "utf8");

        assert.match(routeSource, /summary:\s*"Get Partial Application"/);
        assert.match(routeSource, /with_guild:\s*\{/);
        assert.match(routeSource, /200:\s*\{\s*body:\s*"PublicApplicationResponse"/s);
        assert.match(routeSource, /401:\s*\{\s*body:\s*"APIErrorResponse"/s);
        assert.match(routeSource, /404:\s*\{\s*body:\s*"APIErrorResponse"/s);
    });
});
