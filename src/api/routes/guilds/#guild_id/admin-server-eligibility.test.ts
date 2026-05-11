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
import { afterEach, describe, test, type TestContext } from "node:test";
import type { AddressInfo } from "node:net";
import path from "node:path";
import express from "express";
import { EntityNotFoundError } from "typeorm";

const requireModule = require;
const routeModulePath = require.resolve("./admin-server-eligibility");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /guilds/:guild_id/admin-server-eligibility", () => {
    test("returns the conservative Admin Community eligibility response for an existing guild", async (t) => {
        const harness = setupAdminServerEligibilityRoute(t);

        const response = await requestJson(harness.app, "/guilds/guild-id/admin-server-eligibility");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { eligible_for_admin_server: false });
        assert.deepEqual(harness.guildFindOptions, [
            {
                where: { id: "guild-id" },
                select: { id: true },
            },
        ]);
    });

    test("uses MANAGE_GUILD metadata and declares success plus permission/not-found responses", (t) => {
        const harness = setupAdminServerEligibilityRoute(t);

        assert.deepEqual(harness.getRouteOptions, {
            permission: "MANAGE_GUILD",
            summary: "Get Admin Community Eligibility",
            responses: {
                200: {
                    body: "GuildAdminServerEligibilityResponse",
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

    test("returns the existing API 404 when the guild id does not exist", async (t) => {
        const harness = setupAdminServerEligibilityRoute(t, { missingGuild: true });

        const response = await requestJson(harness.app, "/guilds/missing-guild/admin-server-eligibility");

        assert.equal(response.status, 404);
        assert.equal(response.body.code, 404);
        assert.equal(response.body.message, "Guild could not be found");
        assert.deepEqual(harness.guildFindOptions, [
            {
                where: { id: "missing-guild" },
                select: { id: true },
            },
        ]);
    });
});

type SetupOptions = {
    missingGuild?: boolean;
};

function setupAdminServerEligibilityRoute(t: TestContext, options: SetupOptions = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const guildFindOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (metadata: unknown) => {
        routeOptions.push(metadata);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Guild, "findOneOrFail", async (findOptions: { where?: { id?: string } }) => {
        guildFindOptions.push(findOptions);
        if (options.missingGuild) throw new EntityNotFoundError(util.Guild, findOptions.where);

        return { id: findOptions.where?.id };
    });

    delete require.cache[routeModulePath];
    const router = requireModule(routeModulePath).default as express.Router;
    const app = express();
    app.use("/guilds/:guild_id/admin-server-eligibility", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get getRouteOptions() {
            return routeOptions[0];
        },
        get guildFindOptions() {
            return guildFindOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        server.close();
    }
}
