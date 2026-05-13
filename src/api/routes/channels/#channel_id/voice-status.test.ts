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
const routeModulePath = require.resolve("./voice-status");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("PUT /channels/:channel_id/voice-status", () => {
    test("declares authenticated voice-status metadata", (t) => {
        const harness = setupVoiceStatusRoute(t, {});

        assert.deepEqual(harness.routeOptions[0], {
            requestBody: "VoiceChannelStatusModifySchema",
            coerceRequestBody: false,
            permission: "SET_VOICE_CHANNEL_STATUS",
            event: "VOICE_CHANNEL_STATUS_UPDATE",
            summary: "Modify Channel Status",
            description: "Sets a voice channel's status.",
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
        });
    });

    test("validates required nullable status bodies without scalar coercion", () => {
        const schemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const validate = schemas.nonCoercingAjv.getSchema("VoiceChannelStatusModifySchema");
        assert.ok(validate);

        assert.equal(validate({ status: "Daily standup" }), true, JSON.stringify(validate.errors));
        assert.equal(validate({ status: null }), true, JSON.stringify(validate.errors));
        assert.equal(validate({}), false);
        assert.equal(validate({ status: 123 }), false);
        assert.equal(validate({ status: "x".repeat(501) }), false);
    });

    test("updates status for connected users without MANAGE_CHANNELS", async (t) => {
        const harness = setupVoiceStatusRoute(t, {
            connected: true,
            canManageChannels: false,
        });

        const response = await requestText(harness.app, "/channels/voice/voice-status", {
            method: "PUT",
            body: JSON.stringify({ status: "Daily standup" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.equal(harness.channel.status, "Daily standup");
        assert.equal(harness.saveCalls, 1);
        assert.deepEqual(harness.permissionChecks, []);
        assert.deepEqual(harness.voiceStateCountOptions, [
            {
                where: {
                    channel_id: "voice",
                    user_id: "viewer",
                },
            },
        ]);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "VOICE_CHANNEL_STATUS_UPDATE",
                channel_id: "voice",
                data: {
                    id: "voice",
                    guild_id: "guild",
                    status: "Daily standup",
                },
            },
        ]);
    });

    test("requires MANAGE_CHANNELS when the user is not connected", async (t) => {
        const harness = setupVoiceStatusRoute(t, {
            connected: false,
            canManageChannels: false,
        });

        const response = await requestJson(harness.app, "/channels/voice/voice-status", {
            method: "PUT",
            body: JSON.stringify({ status: "Daily standup" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 403);
        assert.equal(response.body.code, 50013);
        assert.deepEqual(harness.permissionChecks, ["MANAGE_CHANNELS"]);
        assert.equal(harness.saveCalls, 0);
        assert.deepEqual(harness.emitEventCalls, []);
    });

    test("allows disconnected channel managers to clear status", async (t) => {
        const harness = setupVoiceStatusRoute(t, {
            connected: false,
            canManageChannels: true,
            channel: {
                status: "Existing status",
            },
        });

        const response = await requestText(harness.app, "/channels/voice/voice-status", {
            method: "PUT",
            body: JSON.stringify({ status: null }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(harness.channel.status, null);
        assert.deepEqual(harness.permissionChecks, ["MANAGE_CHANNELS"]);
        assert.deepEqual(harness.emitEventCalls, [
            {
                event: "VOICE_CHANNEL_STATUS_UPDATE",
                channel_id: "voice",
                data: {
                    id: "voice",
                    guild_id: "guild",
                    status: null,
                },
            },
        ]);
    });

    test("rejects non-voice channels before connection lookup or mutation", async (t) => {
        const harness = setupVoiceStatusRoute(t, {
            channel: {
                type: ChannelType.GUILD_TEXT,
            },
        });

        const response = await requestJson(harness.app, "/channels/text/voice-status", {
            method: "PUT",
            body: JSON.stringify({ status: "Daily standup" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50024);
        assert.deepEqual(harness.voiceStateCountOptions, []);
        assert.equal(harness.saveCalls, 0);
        assert.deepEqual(harness.emitEventCalls, []);
    });
});

type TestChannel = {
    guild_id?: string | null;
    id?: string;
    status?: string | null;
    type?: ChannelType;
};

type SetupOptions = {
    canManageChannels?: boolean;
    channel?: TestChannel;
    connected?: boolean;
    userId?: string;
};

function setupVoiceStatusRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const eventModule = requireModule(distModulePath("util", "util", "Event.js")) as typeof import("../../../../util/util/Event");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    const voiceStateCountOptions: unknown[] = [];
    const emitEventCalls: unknown[] = [];
    const permissionChecks: string[] = [];
    let saveCalls = 0;
    const channel = {
        guild_id: "guild",
        id: "voice",
        status: null,
        type: ChannelType.GUILD_VOICE,
        ...options.channel,
        async save() {
            saveCalls += 1;
        },
    };

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOneOrFail", async (findOptions: unknown) => {
        channelFindOptions.push(findOptions);
        channel.id = (findOptions as { where?: { id?: string } }).where?.id ?? channel.id;
        return channel;
    });
    t.mock.method(util.VoiceState, "count", async (countOptions: unknown) => {
        voiceStateCountOptions.push(countOptions);
        return (options.connected ?? true) ? 1 : 0;
    });
    t.mock.method(eventModule, "emitEvent", async (event: unknown) => {
        emitEventCalls.push(event);
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./voice-status")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        req.permission = {
            hasThrow(permission: string) {
                permissionChecks.push(permission);
                if (!options.canManageChannels) throw util.DiscordApiErrors.MISSING_PERMISSIONS.withParams(permission);
            },
        } as typeof req.permission;
        next();
    });
    app.use("/channels/:channel_id/voice-status", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        channel,
        get channelFindOptions() {
            return channelFindOptions;
        },
        get emitEventCalls() {
            return emitEventCalls;
        },
        get permissionChecks() {
            return permissionChecks;
        },
        get routeOptions() {
            return routeOptions;
        },
        get saveCalls() {
            return saveCalls;
        },
        get voiceStateCountOptions() {
            return voiceStateCountOptions;
        },
    };
}

async function requestJson(app: express.Express, requestPath: string, init: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await requestText(app, requestPath, init);

    return {
        status: response.status,
        body: JSON.parse(response.body) as Record<string, unknown>,
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
