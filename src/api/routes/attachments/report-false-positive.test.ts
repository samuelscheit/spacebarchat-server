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
const routeModulePath = require.resolve("./report-false-positive");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /attachments/report-false-positive", () => {
    test("declares authenticated empty response metadata", (t) => {
        const harness = setupAttachmentFalsePositiveRoute(t, {});

        assert.deepEqual(harness.postRouteOptions, {
            requestBody: "AttachmentFalsePositiveReportSchema",
            coerceRequestBody: false,
            summary: "Report Explicit Content False Positive",
            description: "Reports an explicit content false positive for a message.",
            responses: emptyResponseMetadata(),
        });
    });

    test("validates false-positive report request bodies without scalar coercion", () => {
        const schemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const validate = schemas.nonCoercingAjv.getSchema("AttachmentFalsePositiveReportSchema");
        assert.ok(validate);

        assert.equal(validate(reportBody()), true, JSON.stringify(validate.errors));
        assert.equal(validate(reportBody({ attachment_ids: [], embed_ids: ["embed_1"] })), true, JSON.stringify(validate.errors));
        assert.equal(validate(reportBody({ channel_id: 123 })), false);
        assert.equal(validate(reportBody({ message_id: "not-a-snowflake" })), false);
        assert.equal(validate(reportBody({ attachment_ids: [123] })), false);
        assert.equal(validate(reportBody({ attachment_ids: Array.from({ length: 101 }, (_, index) => `${index + 1}`) })), false);
        assert.equal(validate(reportBody({ embed_ids: ["embed"] })), false);
        assert.equal(validate(reportBody({ embed_ids: Array.from({ length: 101 }, (_, index) => `embed_${index + 1}`) })), false);
        assert.equal(validate({}), false);
    });

    test("returns unknown message without checking permissions when the message is absent", async (t) => {
        const harness = setupAttachmentFalsePositiveRoute(t, { message: null });

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 404);
        assert.deepEqual(JSON.parse(response.body), {
            code: 10008,
            message: "Unknown message",
        });
        assert.deepEqual(harness.messageFindOptions, [
            {
                where: {
                    id: "222222222222222222",
                    channel_id: "111111111111111111",
                },
                relations: {
                    attachments: true,
                },
            },
        ]);
        assert.equal(harness.getPermissionCalls.length, 0);
    });

    test("requires read access for messages authored by another user", async (t) => {
        const harness = setupAttachmentFalsePositiveRoute(t, {
            missingPermissions: ["READ_MESSAGE_HISTORY"],
        });

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 403);
        assert.equal(JSON.parse(response.body).code, 50013);
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"]);
    });

    test("does not require read-history permission for the current user's own message", async (t) => {
        const harness = setupAttachmentFalsePositiveRoute(t, {
            message: {
                id: "222222222222222222",
                channel_id: "111111111111111111",
                guild_id: "333333333333333333",
                author_id: "viewer",
                attachments: [{ id: "444444444444444444" }],
                embeds: [],
            },
        });

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody({ embed_ids: [] })),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL"]);
    });

    test("rejects attachment IDs that are not on the message", async (t) => {
        const harness = setupAttachmentFalsePositiveRoute(t, {});

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody({ attachment_ids: ["999999999999999999"], embed_ids: [] })),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal(JSON.parse(response.body).message, "Error: Attachment does not belong to message");
    });

    test("returns Discord-compatible 204 empty response after validating message access and targets", async (t) => {
        const harness = setupAttachmentFalsePositiveRoute(t, {});

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(harness.getPermissionCalls, [["viewer", "333333333333333333", "111111111111111111"]]);
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"]);
    });
});

describe("DELETE /attachments/report-false-positive", () => {
    test("declares authenticated empty response metadata", (t) => {
        const harness = setupAttachmentFalsePositiveRoute(t, {});

        assert.deepEqual(harness.deleteRouteOptions, {
            requestBody: "AttachmentFalsePositiveReportSchema",
            coerceRequestBody: false,
            summary: "Delete Explicit Content False Positive Report",
            description: "Deletes an explicit content false-positive report when explicit-media feedback persistence is available.",
            responses: emptyResponseMetadata(),
        });
    });

    test("returns Discord-compatible 204 empty response for a validated report identifier", async (t) => {
        const harness = setupAttachmentFalsePositiveRoute(t, {});

        const response = await requestText(harness.app, {
            method: "DELETE",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY"]);
    });
});

type TestMessage = {
    id: string;
    channel_id: string;
    guild_id?: string;
    author_id?: string;
    attachments?: { id: string }[];
    embeds?: unknown[];
};

type SetupOptions = {
    message?: TestMessage | null;
    missingPermissions?: string[];
};

function setupAttachmentFalsePositiveRoute(t: TestContext, options: SetupOptions) {
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
    const message =
        options.message === undefined
            ? {
                  id: "222222222222222222",
                  channel_id: "111111111111111111",
                  guild_id: "333333333333333333",
                  author_id: "other-user",
                  attachments: [{ id: "444444444444444444" }],
                  embeds: [{}],
              }
            : options.message;

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Message, "findOne", async (findOptions: unknown) => {
        messageFindOptions.push(findOptions);
        return message;
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
    const router = (requireModule(routeModulePath) as typeof import("./report-false-positive")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/attachments/report-false-positive", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get deleteRouteOptions() {
            return routeOptions[0];
        },
        get postRouteOptions() {
            return routeOptions[1];
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

function emptyResponseMetadata() {
    return {
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
    };
}

function reportBody(overrides: Record<string, unknown> = {}) {
    return {
        channel_id: "111111111111111111",
        message_id: "222222222222222222",
        attachment_ids: ["444444444444444444"],
        embed_ids: ["embed_1"],
        ...overrides,
    };
}

async function requestText(app: express.Express, init: RequestInit): Promise<{ status: number; body: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}/attachments/report-false-positive`, init);

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
