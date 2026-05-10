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
const routeModulePath = require.resolve("./call");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /channels/:channel_id/call", () => {
    test("declares authenticated call eligibility response metadata", (t) => {
        const harness = setupCallRoute(t, {});

        assert.deepEqual(harness.routeOptions[0], {
            summary: "Get Call Eligibility",
            description: "Checks if the current user is eligible to ring a call in the private channel.",
            responses: {
                200: {
                    body: "ChannelCallEligibilityResponse",
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
        });
    });

    test("returns ringable for an active DM recipient with another recipient", async (t) => {
        const harness = setupCallRoute(t, {
            channel: {
                type: ChannelType.DM,
                recipients: [
                    { user_id: "viewer", closed: false },
                    { user_id: "other-user", closed: true },
                ],
            },
        });

        const response = await requestJson(harness.app, "/channels/dm/call");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { ringable: true });
        assert.deepEqual(harness.channelFindOptions, [
            {
                where: { id: "dm" },
                relations: { recipients: true },
            },
        ]);
    });

    test("returns non-ringable when the private channel has no other recipients", async (t) => {
        const harness = setupCallRoute(t, {
            channel: {
                type: ChannelType.GROUP_DM,
                recipients: [{ user_id: "viewer", closed: false }],
            },
        });

        const response = await requestJson(harness.app, "/channels/group/call");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { ringable: false });
    });

    test("rejects non-private channel types", async (t) => {
        const harness = setupCallRoute(t, {
            channel: {
                type: ChannelType.GUILD_VOICE,
                recipients: [{ user_id: "viewer", closed: false }],
            },
        });

        const response = await requestJson(harness.app, "/channels/voice/call");

        assert.equal(response.status, 400);
        assert.equal(response.body.code, 50024);
        assert.equal(response.body.message, "Cannot execute action on this channel type");
    });

    test("requires the token user to be an active private-channel recipient", async (t) => {
        const harness = setupCallRoute(t, {
            channel: {
                type: ChannelType.GROUP_DM,
                recipients: [
                    { user_id: "viewer", closed: true },
                    { user_id: "other-user", closed: false },
                ],
            },
        });

        const response = await requestJson(harness.app, "/channels/group/call");

        assert.equal(response.status, 403);
        assert.equal(response.body.code, 50013);
    });
});

describe("PATCH /channels/:channel_id/call", () => {
    test("declares modify-call request and response metadata", (t) => {
        const harness = setupCallRoute(t, {});

        assert.deepEqual(harness.routeOptions[1], {
            requestBody: "ChannelCallModifySchema",
            coerceRequestBody: false,
            summary: "Modify Call",
            description: "Modifies the active call in the private channel.",
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

    test("validates optional string region request bodies", () => {
        const schemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const validate = schemas.nonCoercingAjv.getSchema("ChannelCallModifySchema");
        assert.ok(validate);

        assert.equal(validate({}), true);
        assert.equal(validate({ region: "local" }), true);
        assert.equal(validate({ region: 123 }), false);
    });

    test("returns 204 without persistence when there is no active private call", async (t) => {
        const harness = setupCallRoute(t, { activeVoiceStates: 0 });

        const response = await request(harness.app, "/channels/dm/call", {
            method: "PATCH",
            body: JSON.stringify({ region: "local" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.deepEqual(harness.voiceStateCountOptions, [
            {
                where: { channel_id: "dm" },
            },
        ]);
    });

    test("fails closed for active call region changes because Spacebar has no call-region backing", async (t) => {
        const harness = setupCallRoute(t, { activeVoiceStates: 1 });

        const response = await request(harness.app, "/channels/dm/call", {
            method: "PATCH",
            body: JSON.stringify({ region: "local" }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 501);
        assert.equal(response.body?.code, 501);
        assert.equal(response.body?.message, "Error: Call region modification is not supported");
    });

    test("rejects non-private channel types before active-call lookup", async (t) => {
        const harness = setupCallRoute(t, {
            channel: {
                type: ChannelType.GUILD_VOICE,
                recipients: [{ user_id: "viewer", closed: false }],
            },
        });

        const response = await request(harness.app, "/channels/voice/call", {
            method: "PATCH",
            body: JSON.stringify({}),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body?.code, 50024);
        assert.equal(harness.voiceStateCountOptions.length, 0);
    });

    test("requires the token user to be an active private-channel recipient before active-call lookup", async (t) => {
        const harness = setupCallRoute(t, {
            channel: {
                type: ChannelType.GROUP_DM,
                recipients: [
                    { user_id: "viewer", closed: true },
                    { user_id: "other-user", closed: false },
                ],
            },
        });

        const response = await request(harness.app, "/channels/group/call", {
            method: "PATCH",
            body: JSON.stringify({}),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 403);
        assert.equal(response.body?.code, 50013);
        assert.equal(harness.voiceStateCountOptions.length, 0);
    });
});

describe("POST /channels/:channel_id/call/ring", () => {
    test("declares authenticated call-ring request and response metadata", (t) => {
        const harness = setupCallRoute(t, {});

        assert.deepEqual(harness.routeOptions[2], {
            requestBody: {
                schema: "ChannelCallRingSchema",
                required: false,
            },
            coerceRequestBody: false,
            summary: "Ring Channel Recipients",
            description: "Rings the recipients of a private channel to notify them of an active call.",
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

    test("validates optional nullable recipient request bodies", () => {
        const schemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const validate = schemas.nonCoercingAjv.getSchema("ChannelCallRingSchema");
        assert.ok(validate);

        assert.equal(validate({}), true);
        assert.equal(validate({ recipients: null }), true);
        assert.equal(validate({ recipients: ["other-user"] }), true);
        assert.equal(validate({ recipients: "other-user" }), false);
        assert.equal(validate({ recipients: [123] }), false);
    });

    test("returns 204 without persistence when there is no active private call", async (t) => {
        const harness = setupCallRoute(t, { activeVoiceStates: 0 });

        const response = await request(harness.app, "/channels/dm/call/ring", {
            method: "POST",
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

    test("fails closed for active call ringing because Spacebar has no ringing state or Call Update support", async (t) => {
        const harness = setupCallRoute(t, { activeVoiceStates: 1 });

        const response = await request(harness.app, "/channels/dm/call/ring", {
            method: "POST",
            body: JSON.stringify({ recipients: ["other-user"] }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 501);
        assert.equal(response.body?.code, 501);
        assert.equal(response.body?.message, "Error: Call ringing is not supported");
    });

    test("returns 204 for an active call when the request targets no recipients", async (t) => {
        const harness = setupCallRoute(t, { activeVoiceStates: 1 });

        const response = await request(harness.app, "/channels/dm/call/ring", {
            method: "POST",
            body: JSON.stringify({ recipients: ["viewer"] }),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
    });

    test("rejects non-private channel types before active-call lookup", async (t) => {
        const harness = setupCallRoute(t, {
            channel: {
                type: ChannelType.GUILD_VOICE,
                recipients: [{ user_id: "viewer", closed: false }],
            },
        });

        const response = await request(harness.app, "/channels/voice/call/ring", {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal(response.body?.code, 50024);
        assert.equal(harness.voiceStateCountOptions.length, 0);
    });

    test("requires the token user to be an active private-channel recipient before active-call lookup", async (t) => {
        const harness = setupCallRoute(t, {
            channel: {
                type: ChannelType.GROUP_DM,
                recipients: [
                    { user_id: "viewer", closed: true },
                    { user_id: "other-user", closed: false },
                ],
            },
        });

        const response = await request(harness.app, "/channels/group/call/ring", {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 403);
        assert.equal(response.body?.code, 50013);
        assert.equal(harness.voiceStateCountOptions.length, 0);
    });

    test("rejects recipient IDs outside the private channel before active-call lookup", async (t) => {
        const harness = setupCallRoute(t, {});

        const response = await request(harness.app, "/channels/dm/call/ring", {
            method: "POST",
            body: JSON.stringify({ recipients: ["not-a-recipient"] }),
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

function setupCallRoute(t: TestContext, options: SetupOptions) {
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
    const router = (requireModule(routeModulePath) as typeof import("./call")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = options.userId ?? "viewer";
        next();
    });
    app.use("/channels/:channel_id/call", router);
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

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await request(app, requestPath);

    return {
        status: response.status,
        body: response.body as Record<string, unknown>,
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
