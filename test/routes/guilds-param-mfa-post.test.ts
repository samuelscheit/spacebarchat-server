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
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express from "express";

const requireModule = require;

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

const routeModulePath = distModulePath("api", "routes", "guilds", "#guild_id", "mfa.js");

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /guilds/:guild_id/mfa", () => {
    test("updates the guild MFA level, emits a guild update, and returns the new level", async (t) => {
        const harness = setupGuildMfaRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-id/mfa", {
            method: "POST",
            body: { level: 1 },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { level: 1 });
        assert.deepEqual(harness.guildFindOptions, [
            {
                where: { id: "guild-id" },
                relations: { emojis: true, roles: true, stickers: true },
            },
        ]);
        assert.equal(harness.guild.mfa_level, 1);
        assert.equal(harness.saveCount, 1);
        assert.equal(harness.events[0]?.event, "GUILD_UPDATE");
        assert.equal(harness.events[0]?.guild_id, "guild-id");
        assert.equal((harness.events[0]?.data as { mfa_level?: unknown }).mfa_level, 1);
    });

    test("rejects non-owners before persisting or emitting", async (t) => {
        const harness = setupGuildMfaRoute(t, { ownerId: "owner-id", requestUserId: "other-user-id" });

        const response = await requestJson(harness.app, "/guilds/guild-id/mfa", {
            method: "POST",
            body: { level: 1 },
        });

        assert.equal(response.status, 401);
        assert.match(String(response.body.message), /not the owner/);
        assert.equal(harness.guild.mfa_level, 0);
        assert.equal(harness.saveCount, 0);
        assert.deepEqual(harness.events, []);
    });

    test("validates only documented guild MFA levels without coercion", () => {
        const { nonCoercingAjv } = requireModule(distModulePath("schemas", "Validator.js")) as typeof import("../../src/schemas/Validator");
        const validate = nonCoercingAjv.getSchema("GuildMfaLevelSchema");

        assert.ok(validate, "GuildMfaLevelSchema is registered");
        assert.equal(validate({ level: 0 }), true);
        assert.equal(validate({ level: 1 }), true);
        assert.equal(validate({ level: "1" }), false);
        assert.equal(validate({ level: 2 }), false);
        assert.equal(validate({}), false);
    });
});

type SetupOptions = {
    ownerId?: string;
    requestUserId?: string;
};

function setupGuildMfaRoute(t: TestContext, options: SetupOptions = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../src/api/util/handlers/route");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    const eventModule = requireModule(distModulePath("util", "util", "Event.js")) as typeof import("../../src/util/util/Event");

    const events: unknown[] = [];
    const guildFindOptions: unknown[] = [];
    let saveCount = 0;

    const guild = {
        id: "guild-id",
        owner_id: options.ownerId ?? "owner-id",
        mfa_level: 0,
        toGuildUpdateEventData() {
            return {
                id: this.id,
                mfa_level: this.mfa_level,
            };
        },
        async save() {
            saveCount += 1;
            return this;
        },
    };

    t.mock.method(routeHandler, "route", () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next());
    t.mock.method(eventModule, "emitEvent", async (event: unknown) => {
        events.push(event);
    });
    t.mock.method(util.Guild, "findOneOrFail", async (findOptions: unknown) => {
        guildFindOptions.push(findOptions);
        return guild;
    });

    delete require.cache[routeModulePath];
    const router = requireModule(routeModulePath).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        (req as express.Request & { user_id: string }).user_id = options.requestUserId ?? "owner-id";
        next();
    });
    app.use("/guilds/:guild_id/mfa", router);
    app.use((error: Error & { code?: number; status?: number; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(error.status ?? error.statusCode ?? error.code ?? 500).json({ message: error.message });
    });

    return {
        app,
        get events() {
            return events as { event?: string; guild_id?: string; data?: unknown }[];
        },
        get guild() {
            return guild;
        },
        get guildFindOptions() {
            return guildFindOptions;
        },
        get saveCount() {
            return saveCount;
        },
    };
}

async function requestJson(
    app: express.Express,
    requestPath: string,
    options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        server.close();
    }
}
