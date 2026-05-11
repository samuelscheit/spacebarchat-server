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
import type { Poll } from "@spacebar/schemas";

const requireModule = require;

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

const routeModulePath = distModulePath("api", "routes", "channels", "#channel_id", "polls", "#message_id", "answers", "@me.js");

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("GET /channels/:channel_id/polls/:message_id/answers/@me", () => {
    test("declares authenticated route metadata and response schemas", (t) => {
        const harness = setupPollAnswersMeRoute(t);

        assert.deepEqual(harness.routeOptions[0], {
            permission: "VIEW_CHANNEL",
            responses: {
                200: {
                    body: "PollAnswersResponse",
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

    test("returns a shape-compatible empty answer list for an existing poll", async (t) => {
        const harness = setupPollAnswersMeRoute(t);

        const response = await requestJson(harness.app, "/channels/channel-a/polls/message-a/answers/@me");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { answer_ids: [] });
        assert.deepEqual(harness.messageFindOptions, [{ where: { id: "message-a", channel_id: "channel-a" } }]);
        assert.deepEqual(harness.permissionChecks, ["READ_MESSAGE_HISTORY"]);
    });

    test("does not require read history when the requester authored the poll message", async (t) => {
        const harness = setupPollAnswersMeRoute(t, {
            message: createPollMessage({ author_id: "viewer-id" }),
        });

        const response = await requestJson(harness.app, "/channels/channel-a/polls/message-a/answers/@me");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { answer_ids: [] });
        assert.deepEqual(harness.permissionChecks, []);
    });

    test("rejects non-poll messages as unknown messages", async (t) => {
        const harness = setupPollAnswersMeRoute(t, {
            message: { author_id: "author-id", poll: undefined },
        });

        const response = await requestJson(harness.app, "/channels/channel-a/polls/message-a/answers/@me");

        assert.equal(response.status, 404);
        assert.equal(response.body.code, 10008);
        assert.equal(response.body.message, "Unknown message");
    });

    test("denies answer lookup when a non-author cannot read message history", async (t) => {
        const harness = setupPollAnswersMeRoute(t, { permissionAllowsHistory: false });

        const response = await requestJson(harness.app, "/channels/channel-a/polls/message-a/answers/@me");

        assert.equal(response.status, 403);
        assert.equal(response.body.message, "Error: missing history");
        assert.deepEqual(harness.permissionChecks, ["READ_MESSAGE_HISTORY"]);
    });

    test("validates the generated current-user answer response schema", () => {
        const validator = requireModule(distModulePath("schemas", "Validator.js")) as typeof import("../../src/schemas/Validator");

        assert.equal(validator.ajv.validate("PollAnswersResponse", { answer_ids: [] }), true);
        assert.equal(validator.ajv.validate("PollAnswersResponse", { answer_ids: [1, 2] }), true);
        assert.equal(validator.ajv.validate("PollAnswersResponse", { answer_ids: ["abc"] }), false);
    });
});

type RouteSetupOptions = {
    message?: { author_id?: string; poll?: Poll };
    permissionAllowsHistory?: boolean;
};

function setupPollAnswersMeRoute(t: TestContext, options: RouteSetupOptions = {}) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../src/api/util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../src/api/middlewares/ErrorHandler");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");
    const { HTTPError } = requireModule("lambert-server") as typeof import("lambert-server");

    const routeOptions: unknown[] = [];
    const messageFindOptions: unknown[] = [];
    const permissionChecks: string[] = [];
    const message = options.message ?? createPollMessage();

    t.mock.method(routeHandler, "route", (metadata: unknown) => {
        routeOptions.push(metadata);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Message, "findOneOrFail", async (findOptions: unknown) => {
        messageFindOptions.push(findOptions);
        return message;
    });

    delete require.cache[routeModulePath];
    const router = requireModule(routeModulePath).default as express.Router;
    const app = express();
    app.use((req, _res, next) => {
        Object.assign(req, {
            user_id: "viewer-id",
            permission: {
                hasThrow(permission: string) {
                    permissionChecks.push(permission);
                    if (options.permissionAllowsHistory === false) throw new HTTPError("missing history", 403);
                    return true;
                },
            },
        });
        next();
    });
    app.use("/channels/:channel_id/polls/:message_id/answers/@me", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get messageFindOptions() {
            return messageFindOptions;
        },
        get permissionChecks() {
            return permissionChecks;
        },
        get routeOptions() {
            return routeOptions;
        },
    };
}

function createPollMessage(overrides: Partial<{ author_id: string; poll: Poll }> = {}) {
    return {
        author_id: "author-id",
        poll: {
            question: { text: "Deploy?" },
            answers: [{ answer_id: 1, poll_media: { text: "Yes" } }],
            expiry: new Date("2026-05-11T00:00:00.000Z"),
            allow_multiselect: false,
            layout_type: 1,
            results: {
                is_finalized: false,
                answer_counts: [{ id: 1, count: 3, me_voted: true }],
            },
        },
        ...overrides,
    };
}

async function requestJson(app: express.Express, requestPath: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const server = app.listen(0);
    try {
        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.once("listening", () => resolve());
        });

        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`);

        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}
