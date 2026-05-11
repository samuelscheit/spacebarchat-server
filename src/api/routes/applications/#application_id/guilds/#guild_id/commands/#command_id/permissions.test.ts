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
import path from "node:path";
import { afterEach, test, type TestContext } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { DiscordApiErrors, type ApplicationCommand } from "@spacebar/util";

const requireModule = require;
const routeModulePath = require.resolve("./permissions");

const applicationId = "100000000000000001";
const guildId = "100000000000000002";
const commandId = "100000000000000003";
const userId = "100000000000000004";

afterEach(() => {
    delete require.cache[routeModulePath];
});

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

function setupRouteMetadataHarness(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: Request, _res: Response, next: NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    requireModule(routeModulePath);

    return routeOptions;
}

function loadRouteModule() {
    delete require.cache[routeModulePath];
    return requireModule(routeModulePath) as typeof import("./permissions");
}

function authorizedApplicationRepository(t: TestContext) {
    return {
        findOne: t.mock.fn(async (_options: unknown) => ({
            owner: { id: userId },
            bot: { id: applicationId },
        })),
    };
}

test("GET /applications/:application_id/guilds/:guild_id/commands/:command_id/permissions declares route metadata", (t) => {
    assert.deepEqual(setupRouteMetadataHarness(t), [
        {
            permission: ["MANAGE_GUILD", "MANAGE_ROLES"],
            responses: {
                200: {
                    body: "GuildApplicationCommandPermissions",
                },
                400: {
                    body: "APIErrorResponse",
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
            summary: "Get Application Command Permissions",
        },
    ]);
});

test("application command permissions access rejects bot-token callers before storage lookups", async (t) => {
    const { requireApplicationCommandPermissionsAccess } = loadRouteModule();
    const applicationRepository = {
        findOne: t.mock.fn(async (_options: unknown) => {
            throw new Error("application lookup should not run for bot callers");
        }),
    };

    await assert.rejects(
        () =>
            requireApplicationCommandPermissionsAccess({
                applicationId,
                guildId,
                userId,
                userIsBot: true,
                repositories: { applicationRepository },
            }),
        DiscordApiErrors.UNAUTHORIZED,
    );
    assert.equal(applicationRepository.findOne.mock.callCount(), 0);
});

test("application command permissions access requires the application bot in the guild", async (t) => {
    const { APPLICATION_COMMAND_PERMISSIONS_MISSING_ACCESS, requireApplicationCommandPermissionsAccess } = loadRouteModule();
    const guildExists = t.mock.fn(async (_options: unknown) => true);
    const memberExists = t.mock.fn(async (_options: unknown) => false);

    await assert.rejects(
        () =>
            requireApplicationCommandPermissionsAccess({
                applicationId,
                guildId,
                userId,
                repositories: {
                    applicationRepository: authorizedApplicationRepository(t),
                    guildExists,
                    memberExists,
                },
            }),
        APPLICATION_COMMAND_PERMISSIONS_MISSING_ACCESS,
    );
    assert.equal(guildExists.mock.callCount(), 1);
    assert.equal(memberExists.mock.callCount(), 1);
});

test("application command permissions detail returns global command overwrites in the requested guild", async (t) => {
    const { getApplicationCommandPermissions } = loadRouteModule();
    const findCommand = t.mock.fn(
        async (_options: unknown) =>
            ({
                id: commandId,
                application_id: applicationId,
                permissions: {
                    roles: {
                        [guildId]: false,
                    },
                },
            }) as unknown as ApplicationCommand,
    );

    assert.deepEqual(
        await getApplicationCommandPermissions({
            applicationId,
            guildId,
            commandId,
            repositories: { findCommand },
        }),
        {
            id: commandId,
            application_id: applicationId,
            guild_id: guildId,
            permissions: [{ id: guildId, type: 1, permission: false }],
        },
    );

    const where = (findCommand.mock.calls[0].arguments[0] as { where: Array<Record<string, unknown>> }).where;
    assert.equal(where.length, 2);
    assert.equal(where[0].application_id, applicationId);
    assert.equal(where[0].id, commandId);
    assert.equal(where[1].application_id, applicationId);
    assert.equal(where[1].guild_id, guildId);
    assert.equal(where[1].id, commandId);
});

test("application command permissions detail returns an empty permissions array for commands without overwrites", async (t) => {
    const { getApplicationCommandPermissions } = loadRouteModule();
    const findCommand = t.mock.fn(
        async (_options: unknown) =>
            ({
                id: commandId,
                application_id: applicationId,
                permissions: null as unknown as ApplicationCommand["permissions"],
            }) as unknown as ApplicationCommand,
    );

    assert.deepEqual(
        await getApplicationCommandPermissions({
            applicationId,
            guildId,
            commandId,
            repositories: { findCommand },
        }),
        {
            id: commandId,
            application_id: applicationId,
            guild_id: guildId,
            permissions: [],
        },
    );
});

test("application command permissions detail returns null for unknown commands", async (t) => {
    const { getApplicationCommandPermissions } = loadRouteModule();
    const findCommand = t.mock.fn(async (_options: unknown) => null);

    assert.equal(
        await getApplicationCommandPermissions({
            applicationId,
            guildId,
            commandId,
            repositories: { findCommand },
        }),
        null,
    );
});
