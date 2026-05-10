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
const moduleAlias = requireModule("module-alias") as { addAliases(aliases: Record<string, string>): void };
const routeModulePath = require.resolve("./pins");

moduleAlias.addAliases({
    "@spacebar/api": path.join(process.cwd(), "dist", "api"),
    "@spacebar/util": path.join(process.cwd(), "dist", "util"),
    "@spacebar/schemas": path.join(process.cwd(), "dist", "schemas"),
    "lambert-server": path.join(process.cwd(), "dist", "util", "util", "lambert-server"),
});

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("/channels/:channel_id/pins/ack", () => {
    test("declares authenticated metadata for all compatibility methods before message-id pin routes", (t) => {
        const harness = setupPinsRoute(t, {});

        const expected = {
            permission: "VIEW_CHANNEL",
            summary: "Acknowledge Pinned Messages",
            description: "Acknowledges the current user's pinned-message read state for the channel.",
            responses: {
                204: {},
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
        };

        assert.deepEqual(harness.routeOptions.slice(0, 3), [expected, expected, expected]);
    });

    for (const method of ["DELETE", "POST", "PUT"] as const) {
        test(`${method} acknowledges the latest pinned message timestamp`, async (t) => {
            const pinnedAt = new Date("2026-05-08T12:34:56.000Z");
            const harness = setupPinsRoute(t, {
                pinnedAt,
                userId: "ack-user",
            });

            const response = await requestText(harness.app, "/channels/channel-id/pins/ack", { method });

            assert.equal(response.status, 204);
            assert.equal(response.body, "");
            assert.equal(harness.messageFindOptions.length, 1);
            const findOptions = harness.messageFindOptions[0] as {
                where: { channel_id: string; pinned_at: unknown };
                select: { pinned_at: boolean };
                order: { pinned_at: string };
            };
            assert.equal(findOptions.where.channel_id, "channel-id");
            assert.ok(findOptions.where.pinned_at);
            assert.deepEqual(findOptions.select, { pinned_at: true });
            assert.deepEqual(findOptions.order, { pinned_at: "DESC" });
            assert.deepEqual(harness.upsertPinsReadStateCalls, [
                [
                    {
                        user_id: "ack-user",
                        channel_id: "channel-id",
                    },
                    pinnedAt,
                ],
            ]);
            assert.deepEqual(harness.emitEventCalls, [
                {
                    event: "CHANNEL_PINS_ACK",
                    user_id: "ack-user",
                    data: {
                        channel_id: "channel-id",
                        timestamp: "2026-05-08T12:34:56.000Z",
                        version: 232,
                    },
                },
            ]);
        });
    }

    test("acknowledges empty pin state with the read-state default timestamp", async (t) => {
        const harness = setupPinsRoute(t, {});

        const response = await requestText(harness.app, "/channels/channel-id/pins/ack", { method: "POST" });

        assert.equal(response.status, 204);
        assert.deepEqual(harness.upsertPinsReadStateCalls, [
            [
                {
                    user_id: "viewer",
                    channel_id: "channel-id",
                },
                new Date(0),
            ],
        ]);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "CHANNEL_PINS_ACK",
                user_id: "viewer",
                data: {
                    channel_id: "channel-id",
                    timestamp: "1970-01-01T00:00:00.000Z",
                    version: 232,
                },
            },
        ]);
    });
});

type SetupOptions = {
    pinnedAt?: Date;
    userId?: string;
};

function setupPinsRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const eventModule = requireModule(distModulePath("util", "util", "Event.js")) as typeof import("../../../../util/util/Event");
    const readStatePersistence = requireModule(distModulePath("util", "util", "ReadStatePersistence.js")) as typeof import("../../../../util/util/ReadStatePersistence");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const messageFindOptions: unknown[] = [];
    const upsertPinsReadStateCalls: unknown[] = [];
    const emitEventCalls: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Message, "findOne", async (findOptions: unknown) => {
        messageFindOptions.push(findOptions);

        if (!options.pinnedAt) return null;
        return {
            pinned_at: options.pinnedAt,
        };
    });
    t.mock.method(readStatePersistence, "upsertChannelPinsReadState", async (...args: unknown[]) => {
        upsertPinsReadStateCalls.push(args);
    });
    t.mock.method(eventModule, "emitEvent", async (event: unknown) => {
        emitEventCalls.push(event);
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./pins")).default as express.Router;
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/channels/:channel_id/pins", router);

    return {
        app,
        get routeOptions() {
            return routeOptions;
        },
        get messageFindOptions() {
            return messageFindOptions;
        },
        get upsertPinsReadStateCalls() {
            return upsertPinsReadStateCalls;
        },
        get emitEventCalls() {
            return emitEventCalls;
        },
    };
}

async function requestText(app: express.Express, requestPath: string, init: RequestInit): Promise<{ status: number; body: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init);

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
