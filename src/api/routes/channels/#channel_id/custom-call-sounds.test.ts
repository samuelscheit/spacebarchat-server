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
const routeModulePath = require.resolve("./custom-call-sounds");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /channels/:channel_id/custom-call-sounds", () => {
    test("declares authenticated custom-call-sounds response metadata", (t) => {
        const harness = setupCustomCallSoundsRoute(t, {});

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Send Custom Call Sound",
            description: "Sends a custom call sound in an active private channel call.",
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
                501: {
                    body: "APIErrorResponse",
                },
            },
        });
    });

    test("returns 204 without persistence when there is no active private call", async (t) => {
        const harness = setupCustomCallSoundsRoute(t, { activeVoiceStates: 0 });

        const response = await request(harness.app, "/channels/dm/custom-call-sounds", {
            method: "POST",
            body: JSON.stringify({ sound_id: "source-unknown" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { id: "dm" },
                relations: { recipients: true },
            },
        ]);
        assert.deepEqual(harness.voiceStateCountOptions, [
            {
                where: { channel_id: "dm" },
            },
        ]);
    });

    test("fails closed for active calls because Spacebar has no custom call sound backing", async (t) => {
        const harness = setupCustomCallSoundsRoute(t, { activeVoiceStates: 1 });

        const response = await request(harness.app, "/channels/dm/custom-call-sounds", {
            method: "POST",
            body: JSON.stringify({ sound_id: "source-unknown" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 501);
        assert.equal(response.body?.code, 501);
        assert.equal(response.body?.message, "Error: Custom call sounds are not supported");
    });

    test("rejects non-private channel types before active-call lookup", async (t) => {
        const harness = setupCustomCallSoundsRoute(t, {
            channel: {
                type: ChannelType.GUILD_VOICE,
                recipients: [{ user_id: "viewer", closed: false }],
            },
        });

        const response = await request(harness.app, "/channels/voice/custom-call-sounds", {
            method: "POST",
            body: JSON.stringify({ sound_id: "source-unknown" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body?.code, 50024);
        assert.equal(harness.voiceStateCountOptions.length, 0);
    });

    test("requires the token user to be an active private-channel recipient before active-call lookup", async (t) => {
        const harness = setupCustomCallSoundsRoute(t, {
            channel: {
                type: ChannelType.GROUP_DM,
                recipients: [
                    { user_id: "viewer", closed: true },
                    { user_id: "other-user", closed: false },
                ],
            },
        });

        const response = await request(harness.app, "/channels/group/custom-call-sounds", {
            method: "POST",
            body: JSON.stringify({ sound_id: "source-unknown" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 403);
        assert.equal(response.body?.code, 50013);
        assert.equal(harness.voiceStateCountOptions.length, 0);
    });
});

type TestRecipient = {
    closed: boolean;
    user_id: string;
};

type TestChannel = {
    id?: string;
    type: ChannelType;
    recipients?: TestRecipient[];
};

type SetupOptions = {
    activeVoiceStates?: number;
    channel?: TestChannel;
    userId?: string;
};

function setupCustomCallSoundsRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../../middlewares/ErrorHandler");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    const voiceStateCountOptions: unknown[] = [];
    const channel = options.channel ?? {
        type: ChannelType.DM,
        recipients: [
            { user_id: "viewer", closed: false },
            { user_id: "other-user", closed: false },
        ],
    };

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOneOrFail", async (findOptions: unknown) => {
        channelFindOptions.push(findOptions);
        const requestedId = (findOptions as { where?: { id?: string } }).where?.id ?? channel.id ?? "channel";
        return { id: requestedId, ...channel };
    });
    t.mock.method(util.VoiceState, "count", async (countOptions: unknown) => {
        voiceStateCountOptions.push(countOptions);
        return options.activeVoiceStates ?? 0;
    });

    delete require.cache[routeModulePath];
    const router = (requireModule(routeModulePath) as typeof import("./custom-call-sounds")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/channels/:channel_id/custom-call-sounds", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get channelFindOptions() {
            return channelFindOptions;
        },
        get routeOptions() {
            return routeOptions;
        },
        get voiceStateCountOptions() {
            return voiceStateCountOptions;
        },
    };
}

async function request(app: express.Express, requestPath: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> | undefined }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, init);
        const text = await response.text();

        return {
            status: response.status,
            body: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
        };
    } finally {
        server.close();
    }
}
