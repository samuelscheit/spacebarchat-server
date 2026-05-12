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

const requireModule = require;
const routeModulePath = require.resolve("./explicit-media");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("PATCH /messages/explicit-media", () => {
    test("declares authenticated empty response metadata", (t) => {
        const harness = setupExplicitMediaScanRoute(t, {});

        assert.deepEqual(harness.patchRouteOptions, {
            requestBody: "MessageExplicitMediaScanSchema",
            coerceRequestBody: false,
            summary: "Bulk Scan Explicit Media",
            description:
                "Accepts a bulk explicit-media scan request for locally visible messages without fabricating scan results when no explicit-media scanner is configured.",
            responses: {
                204: {},
                400: {
                    body: "APIErrorResponse",
                },
                401: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("validates bulk explicit-media scan request bodies without scalar coercion", () => {
        const schemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const validate = schemas.nonCoercingAjv.getSchema("MessageExplicitMediaScanSchema");
        assert.ok(validate);

        assert.equal(validate(scanBody()), true, JSON.stringify(validate.errors));
        assert.equal(validate(scanBody({ messages: [{ channel_id: "111111111111111111", message_id: "222222222222222222" }] })), true, JSON.stringify(validate.errors));
        assert.equal(validate(scanBody({ messages: [] })), false);
        assert.equal(validate(scanBody({ messages: Array.from({ length: 101 }, (_, index) => ({ channel_id: "111111111111111111", message_id: `${index + 1}` })) })), false);
        assert.equal(validate(scanBody({ messages: [{ channel_id: 123, message_id: "222222222222222222" }] })), false);
        assert.equal(validate(scanBody({ messages: [{ channel_id: "not-a-snowflake", message_id: "222222222222222222" }] })), false);
        assert.equal(validate(scanBody({ messages: [{ channel_id: "111111111111111111", message_id: 123 }] })), false);
        assert.equal(validate({}), false);
    });

    test("ignores missing messages and returns a 204 empty response", async (t) => {
        const harness = setupExplicitMediaScanRoute(t, { messages: [] });

        const response = await requestText(harness.app, {
            method: "PATCH",
            body: JSON.stringify(scanBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.equal(harness.getPermissionCalls.length, 0);
    });

    test("requires visibility before considering a local message scannable", async (t) => {
        const harness = setupExplicitMediaScanRoute(t, {
            missingPermissions: ["READ_MESSAGE_HISTORY"],
        });

        const response = await requestText(harness.app, {
            method: "PATCH",
            body: JSON.stringify(scanBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"]);
    });

    test("does not require read history for the current user's own message", async (t) => {
        const harness = setupExplicitMediaScanRoute(t, {
            messages: [
                {
                    id: "222222222222222222",
                    channel_id: "111111111111111111",
                    guild_id: "333333333333333333",
                    author_id: "viewer",
                },
            ],
        });

        const response = await requestText(harness.app, {
            method: "PATCH",
            body: JSON.stringify(scanBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL"]);
    });

    test("deduplicates requested channel-message pairs before resolving local messages", async (t) => {
        const harness = setupExplicitMediaScanRoute(t, {});

        const response = await requestText(harness.app, {
            method: "PATCH",
            body: JSON.stringify(
                scanBody({
                    messages: [
                        { channel_id: "111111111111111111", message_id: "222222222222222222" },
                        { channel_id: "111111111111111111", message_id: "222222222222222222" },
                    ],
                }),
            ),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.deepEqual(harness.messageFindOptions, [
            {
                where: [
                    {
                        id: "222222222222222222",
                        channel_id: "111111111111111111",
                    },
                ],
                select: {
                    id: true,
                    channel_id: true,
                    guild_id: true,
                    author_id: true,
                },
            },
        ]);
    });
});

describe("generated route artifacts for /messages/explicit-media", () => {
    test("source route catalog contains PATCH for the exact global explicit-media path", () => {
        const catalogPath = path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json");
        const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Array<{
            method: string;
            route: string;
            request_schema_ref?: string;
            source: string;
        }>;

        const entries = catalog.filter((entry) => entry.route === "/messages/explicit-media");
        assert.deepEqual(entries.map((entry) => entry.method).sort(), ["PATCH"]);
        assert.ok(entries.every((entry) => entry.source === "src/api/routes/messages/explicit-media.ts"));
        assert.ok(entries.every((entry) => entry.request_schema_ref === "MessageExplicitMediaScanSchema"));
    });
});

type TestMessage = {
    id: string;
    channel_id: string;
    guild_id?: string;
    author_id?: string;
};

type SetupOptions = {
    messages?: TestMessage[];
    missingPermissions?: string[];
};

function setupExplicitMediaScanRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../middlewares/ErrorHandler");
    const permissionsModule = requireModule(distModulePath("util", "util", "Permissions.js")) as typeof import("../../../util/util/Permissions");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const messageFindOptions: unknown[] = [];
    const getPermissionCalls: unknown[] = [];
    const permissionChecks: string[] = [];
    const missingPermissions = new Set(options.missingPermissions ?? []);
    const messages = options.messages ?? [
        {
            id: "222222222222222222",
            channel_id: "111111111111111111",
            guild_id: "333333333333333333",
            author_id: "other-user",
        },
    ];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Message, "find", async (findOptions: unknown) => {
        messageFindOptions.push(findOptions);
        return messages;
    });
    t.mock.method(permissionsModule, "getPermission", async (...args: unknown[]) => {
        getPermissionCalls.push(args);
        return {
            hasThrow(permission: string) {
                permissionChecks.push(permission);
                if (missingPermissions.has(permission)) throw util.DiscordApiErrors.MISSING_PERMISSIONS.withParams(permission);
            },
        };
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./explicit-media")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/messages/explicit-media", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get patchRouteOptions() {
            return routeOptions[0];
        },
        get messageFindOptions() {
            return messageFindOptions;
        },
        get getPermissionCalls() {
            return getPermissionCalls;
        },
        get permissionChecks() {
            return permissionChecks;
        },
    };
}

function scanBody(overrides: Record<string, unknown> = {}) {
    return {
        messages: [
            {
                channel_id: "111111111111111111",
                message_id: "222222222222222222",
            },
        ],
        ...overrides,
    };
}

async function requestText(app: express.Express, init: RequestInit): Promise<{ status: number; body: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}/messages/explicit-media`, init);

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
