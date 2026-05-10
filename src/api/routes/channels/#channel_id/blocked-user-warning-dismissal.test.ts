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
const routeModulePath = require.resolve("./blocked-user-warning-dismissal");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /channels/:channel_id/blocked-user-warning-dismissal", () => {
    test("declares authenticated group-DM acknowledgement metadata", (t) => {
        const harness = setupBlockedUserWarningDismissalRoute(t, {});

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Acknowledge Blocked User Warning",
            description: "Acknowledges that a group DM contains users the current user has blocked.",
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
        const harness = setupBlockedUserWarningDismissalRoute(t, {});

        const response = await requestText(harness.app, "/channels/not-a-snowflake/blocked-user-warning-dismissal");

        assert.equal(response.status, 404);
        assert.deepEqual(JSON.parse(response.body), {
            code: 10003,
            message: "Unknown channel",
        });
        assert.equal(harness.channelFindOptions.length, 0);
        assert.equal(harness.emitEventCalls.length, 0);
    });

    test("rejects non-group-DM channel types", async (t) => {
        const harness = setupBlockedUserWarningDismissalRoute(t, {
            channel: {
                id: "133713371337133713",
                type: ChannelType.DM,
                recipients: [
                    { user_id: "viewer", closed: false },
                    { user_id: "other-user", closed: false },
                ],
            },
        });

        const response = await requestText(harness.app, "/channels/133713371337133713/blocked-user-warning-dismissal");

        assert.equal(response.status, 400);
        assert.deepEqual(JSON.parse(response.body), {
            code: 50024,
            message: "Cannot execute action on this channel type",
        });
        assert.equal(harness.emitEventCalls.length, 0);
        assert.equal(harness.dmChannelDtoFromCalls.length, 0);
    });

    test("requires the token user to be an active group-DM recipient", async (t) => {
        const harness = setupBlockedUserWarningDismissalRoute(t, {
            channel: {
                id: "133713371337133713",
                type: ChannelType.GROUP_DM,
                recipients: [
                    { user_id: "viewer", closed: true },
                    { user_id: "blocked-user", closed: false },
                ],
            },
        });

        const response = await requestText(harness.app, "/channels/133713371337133713/blocked-user-warning-dismissal");

        assert.equal(response.status, 403);
        assert.deepEqual(JSON.parse(response.body), {
            code: 50013,
            message: "You lack permissions to perform that action ({})",
        });
        assert.equal(harness.emitEventCalls.length, 0);
        assert.equal(harness.dmChannelDtoFromCalls.length, 0);
    });

    test("returns Discord-compatible 200 empty response and emits a user-scoped channel update", async (t) => {
        const channel: TestChannel = {
            id: "133713371337133713",
            type: ChannelType.GROUP_DM,
            recipients: [
                { user_id: "viewer", closed: false },
                { user_id: "blocked-user", closed: false },
            ],
        };
        const harness = setupBlockedUserWarningDismissalRoute(t, { channel });

        const response = await requestText(harness.app, "/channels/133713371337133713/blocked-user-warning-dismissal");

        assert.equal(response.status, 200);
        assert.equal(response.body, "");
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { id: "133713371337133713" },
                relations: { recipients: true },
            },
        ]);
        assert.deepEqual(harness.dmChannelDtoFromCalls, [channel]);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "CHANNEL_UPDATE",
                user_id: "viewer",
                data: {
                    id: "133713371337133713",
                    type: ChannelType.GROUP_DM,
                    recipients: [{ id: "blocked-user" }],
                    blocked_user_warning_dismissed: true,
                },
            },
        ]);
    });
});

type TestRecipient = {
    closed: boolean;
    user_id: string;
};

type TestChannel = {
    id: string;
    type: ChannelType;
    recipients?: TestRecipient[];
};

type SetupOptions = {
    channel?: TestChannel;
    userId?: string;
};

function setupBlockedUserWarningDismissalRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const eventModule = requireModule(distModulePath("util", "util", "Event.js")) as typeof import("../../../../util/util/Event");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    const emitEventCalls: unknown[] = [];
    const dmChannelDtoFromCalls: unknown[] = [];
    const channel = options.channel ?? {
        id: "133713371337133713",
        type: ChannelType.GROUP_DM,
        recipients: [
            { user_id: "viewer", closed: false },
            { user_id: "blocked-user", closed: false },
        ],
    };

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOneOrFail", async (findOptions: unknown) => {
        channelFindOptions.push(findOptions);
        return channel;
    });
    t.mock.method(util.DmChannelDTO, "from", async (source: TestChannel) => {
        dmChannelDtoFromCalls.push(source);
        const recipients = (source.recipients ?? []).map((recipient) => ({ id: recipient.user_id }));

        return {
            id: source.id,
            type: source.type,
            recipients,
            forRecipient(recipientId: string) {
                return {
                    id: source.id,
                    type: source.type,
                    recipients: recipients.filter((recipient) => recipient.id !== recipientId),
                };
            },
        };
    });
    t.mock.method(eventModule, "emitEvent", async (event: unknown) => {
        emitEventCalls.push(event);
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./blocked-user-warning-dismissal")).default as express.Router;
    const app = express();
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/channels/:channel_id/blocked-user-warning-dismissal", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get channelFindOptions() {
            return channelFindOptions;
        },
        get dmChannelDtoFromCalls() {
            return dmChannelDtoFromCalls;
        },
        get emitEventCalls() {
            return emitEventCalls;
        },
        get routeOptions() {
            return routeOptions;
        },
    };
}

async function requestText(app: express.Express, requestPath: string): Promise<{ status: number; body: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, {
            method: "POST",
        });

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
