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
import { ChannelType } from "@spacebar/schemas";

const requireModule = require;
const routeModulePath = require.resolve("./safety-warnings");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("DELETE /channels/:channel_id/safety-warnings", () => {
    test("declares operator-only empty response metadata", (t) => {
        const harness = setupSafetyWarningsRoute(t, {});

        assert.deepEqual(harness.deleteRouteOptions, {
            summary: "Delete Safety Warnings",
            description: "Deletes all safety warnings for a DM channel when safety-warning persistence is available.",
            right: "OPERATOR",
            event: "CHANNEL_UPDATE",
            responses: {
                200: {},
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
        });
    });

    test("rejects invalid channel IDs before database lookup", async (t) => {
        const harness = setupSafetyWarningsRoute(t, {});

        const response = await requestText(harness.app, "/channels/not-a-snowflake/safety-warnings");

        assert.equal(response.status, 404);
        assert.deepEqual(JSON.parse(response.body), {
            code: 10003,
            message: "Unknown channel",
        });
        assert.equal(harness.channelFindOptions.length, 0);
        assert.equal(harness.emitEventCalls.length, 0);
    });

    test("rejects non-DM channels without mutating state", async (t) => {
        const harness = setupSafetyWarningsRoute(t, {
            channel: {
                id: "133713371337133713",
                type: ChannelType.GUILD_TEXT,
            },
        });

        const response = await requestText(harness.app, "/channels/133713371337133713/safety-warnings");

        assert.equal(response.status, 400);
        assert.deepEqual(JSON.parse(response.body), {
            code: 50024,
            message: "Cannot execute action on this channel type",
        });
        assert.equal(harness.channelFindOptions.length, 1);
        assert.equal(harness.emitEventCalls.length, 0);
    });

    test("returns Discord-compatible 200 empty response for DM channels", async (t) => {
        const harness = setupSafetyWarningsRoute(t, {
            channel: {
                id: "133713371337133713",
                type: ChannelType.DM,
            },
        });

        const response = await requestText(harness.app, "/channels/133713371337133713/safety-warnings");

        assert.equal(response.status, 200);
        assert.equal(response.body, "");
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { id: "133713371337133713" },
                select: {
                    id: true,
                    type: true,
                },
            },
        ]);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "CHANNEL_UPDATE",
                channel_id: "133713371337133713",
                data: {
                    id: "133713371337133713",
                    type: ChannelType.DM,
                    safety_warnings: [],
                },
            },
        ]);
    });
});

describe("POST /channels/:channel_id/safety-warnings/ack", () => {
    test("declares authenticated request and empty response metadata", (t) => {
        const harness = setupSafetyWarningsRoute(t, {});

        assert.deepEqual(harness.postAckRouteOptions, {
            requestBody: "ChannelSafetyWarningsAckSchema",
            coerceRequestBody: false,
            summary: "Acknowledge Safety Warnings",
            description: "Dismisses selected safety warnings for a DM channel when safety-warning persistence is available.",
            event: "CHANNEL_UPDATE",
            responses: {
                200: {},
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
        });
    });

    test("validates warning ID request bodies without scalar coercion", () => {
        const schemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const validate = schemas.nonCoercingAjv.getSchema("ChannelSafetyWarningsAckSchema");
        assert.ok(validate);

        assert.equal(validate({ warning_ids: ["warning-1"] }), true);
        assert.equal(validate({ warning_ids: [] }), false);
        assert.equal(validate({ warning_ids: Array.from({ length: 101 }, (_, index) => `warning-${index}`) }), false);
        assert.equal(validate({ warning_ids: [123] }), false);
        assert.equal(validate({}), false);
    });

    test("rejects invalid channel IDs before database lookup", async (t) => {
        const harness = setupSafetyWarningsRoute(t, {});

        const response = await requestText(harness.app, "/channels/not-a-snowflake/safety-warnings/ack", {
            method: "POST",
            body: JSON.stringify({ warning_ids: ["warning-1"] }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 404);
        assert.deepEqual(JSON.parse(response.body), {
            code: 10003,
            message: "Unknown channel",
        });
        assert.equal(harness.channelFindOptions.length, 0);
        assert.equal(harness.emitEventCalls.length, 0);
    });

    test("rejects non-DM channels without mutating state", async (t) => {
        const harness = setupSafetyWarningsRoute(t, {
            channel: {
                id: "133713371337133713",
                type: ChannelType.GUILD_TEXT,
                recipients: [{ user_id: "viewer", closed: false }],
            },
        });

        const response = await requestText(harness.app, "/channels/133713371337133713/safety-warnings/ack", {
            method: "POST",
            body: JSON.stringify({ warning_ids: ["warning-1"] }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.deepEqual(JSON.parse(response.body), {
            code: 50024,
            message: "Cannot execute action on this channel type",
        });
        assert.equal(harness.channelFindOptions.length, 1);
        assert.equal(harness.emitEventCalls.length, 0);
    });

    test("requires the token user to be an active DM recipient", async (t) => {
        const harness = setupSafetyWarningsRoute(t, {
            channel: {
                id: "133713371337133713",
                type: ChannelType.DM,
                recipients: [
                    { user_id: "viewer", closed: true },
                    { user_id: "other-user", closed: false },
                ],
            },
        });

        const response = await requestText(harness.app, "/channels/133713371337133713/safety-warnings/ack", {
            method: "POST",
            body: JSON.stringify({ warning_ids: ["warning-1"] }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 403);
        assert.equal(JSON.parse(response.body).code, 50013);
        assert.equal(harness.emitEventCalls.length, 0);
    });

    test("returns Discord-compatible 200 empty response for active DM recipients", async (t) => {
        const harness = setupSafetyWarningsRoute(t, {
            channel: {
                id: "133713371337133713",
                type: ChannelType.DM,
                recipients: [
                    { user_id: "viewer", closed: false },
                    { user_id: "other-user", closed: false },
                ],
            },
        });

        const response = await requestText(harness.app, "/channels/133713371337133713/safety-warnings/ack", {
            method: "POST",
            body: JSON.stringify({ warning_ids: ["warning-1"] }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 200);
        assert.equal(response.body, "");
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { id: "133713371337133713" },
                relations: { recipients: true },
            },
        ]);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "CHANNEL_UPDATE",
                channel_id: "133713371337133713",
                data: {
                    id: "133713371337133713",
                    type: ChannelType.DM,
                    safety_warnings: [],
                },
            },
        ]);
    });
});

type TestChannel = {
    id: string;
    type: ChannelType;
    recipients?: {
        closed: boolean;
        user_id: string;
    }[];
};

type SetupOptions = {
    channel?: TestChannel | null;
};

function setupSafetyWarningsRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const eventModule = requireModule(distModulePath("util", "util", "Event.js")) as typeof import("../../../../util/util/Event");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    const emitEventCalls: unknown[] = [];
    const channel =
        options.channel === undefined
            ? {
                  id: "133713371337133713",
                  type: ChannelType.DM,
                  recipients: [
                      { user_id: "viewer", closed: false },
                      { user_id: "other-user", closed: false },
                  ],
              }
            : options.channel;

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOne", async (findOptions: unknown) => {
        channelFindOptions.push(findOptions);
        return channel;
    });
    t.mock.method(eventModule, "emitEvent", async (event: unknown) => {
        emitEventCalls.push(event);
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./safety-warnings")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/channels/:channel_id/safety-warnings", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get channelFindOptions() {
            return channelFindOptions;
        },
        get emitEventCalls() {
            return emitEventCalls;
        },
        get deleteRouteOptions() {
            return routeOptions[0];
        },
        get postAckRouteOptions() {
            return routeOptions[1];
        },
    };
}

async function requestText(app: express.Express, requestPath: string, init?: RequestInit): Promise<{ status: number; body: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init ?? { method: "DELETE" });

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
