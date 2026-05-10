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
const routeModulePath = require.resolve("./sender-report-false-positive");

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

afterEach(() => {
    delete require.cache[routeModulePath];
});

describe("POST /attachments/sender-report-false-positive", () => {
    test("declares authenticated empty response metadata", (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {});

        assert.deepEqual(harness.postRouteOptions, {
            requestBody: "AttachmentSenderFalsePositiveReportSchema",
            coerceRequestBody: false,
            summary: "Report Sent Explicit Content False Positive",
            description: "Reports an explicit content false positive for uploaded attachments after a send failure.",
            responses: emptyResponseMetadata(),
        });
    });

    test("validates sender false-positive request bodies without scalar coercion", () => {
        const schemas = requireModule("@spacebar/schemas") as typeof import("@spacebar/schemas");
        const validate = schemas.nonCoercingAjv.getSchema("AttachmentSenderFalsePositiveReportSchema");
        assert.ok(validate);

        assert.equal(validate(reportBody()), true, JSON.stringify(validate.errors));
        assert.equal(validate(reportBody({ channel_id: 123 })), false);
        assert.equal(validate(reportBody({ message_id: "not-a-snowflake" })), false);
        assert.equal(validate(reportBody({ attachment_ids: [123] })), false);
        assert.equal(validate(reportBody({ attachment_ids: Array.from({ length: 101 }, (_, index) => `${index + 1}`) })), false);
        assert.equal(validate(reportBody({ filenames: [123] })), false);
        assert.equal(validate(reportBody({ filenames: [""] })), false);
        assert.equal(validate(reportBody({ filenames: ["x".repeat(1025)] })), false);
        assert.equal(validate(reportBody({ filenames: Array.from({ length: 101 }, (_, index) => `file-${index + 1}.png`) })), false);
        assert.equal(validate({}), false);
    });

    test("returns unknown channel without checking permissions when the channel is absent", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, { channel: null });

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 404);
        assert.deepEqual(JSON.parse(response.body), {
            code: 10003,
            message: "Unknown channel",
        });
        assert.equal(harness.getPermissionCalls.length, 0);
        assert.equal(harness.cloudAttachmentFindOptions.length, 0);
    });

    test("requires attachment permission in the channel", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {
            missingPermissions: ["ATTACH_FILES"],
        });

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 403);
        assert.equal(JSON.parse(response.body).code, 50013);
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL", "ATTACH_FILES"]);
        assert.equal(harness.cloudAttachmentFindOptions.length, 0);
    });

    test("rejects mismatched attachment IDs and filenames", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {});

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody({ filenames: ["image.png", "extra.png"] })),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal(JSON.parse(response.body).message, "Error: Attachment IDs and filenames must have matching lengths");
        assert.equal(harness.channelFindOptions.length, 0);
        assert.equal(harness.cloudAttachmentFindOptions.length, 0);
    });

    test("rejects duplicate attachment IDs", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {});

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(
                reportBody({
                    attachment_ids: ["444444444444444444", "444444444444444444"],
                    filenames: ["image.png", "image-copy.png"],
                }),
            ),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal(JSON.parse(response.body).message, "Error: Duplicate attachment ID: 444444444444444444");
        assert.equal(harness.channelFindOptions.length, 0);
        assert.equal(harness.cloudAttachmentFindOptions.length, 0);
    });

    test("rejects attachment IDs that are not uploaded in the channel", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {
            cloudAttachments: [],
        });

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal(JSON.parse(response.body).message, "Error: Attachment does not belong to this channel");
        assert.equal(harness.cloudAttachmentFindOptions.length, 1);
    });

    test("rejects uploaded attachments owned by another user", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {
            cloudAttachments: [
                {
                    channelId: "111111111111111111",
                    userId: "other-user",
                    userAttachmentId: "444444444444444444",
                    userFilename: "image.png",
                },
            ],
        });

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 403);
        assert.equal(JSON.parse(response.body).message, "Error: You do not own this attachment");
    });

    test("rejects filenames that do not match the uploaded attachment", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {});

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody({ filenames: ["different.png"] })),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 400);
        assert.equal(JSON.parse(response.body).message, "Error: Attachment filename does not match uploaded attachment");
    });

    test("accepts the matching uploaded attachment when stale rows reuse the same client attachment ID", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {
            cloudAttachments: [
                {
                    channelId: "111111111111111111",
                    userId: "viewer",
                    userAttachmentId: "444444444444444444",
                    userFilename: "old-image.png",
                },
                {
                    channelId: "111111111111111111",
                    userId: "viewer",
                    userAttachmentId: "444444444444444444",
                    userFilename: "image.png",
                },
            ],
        });

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
    });

    test("returns Discord-compatible 204 empty response after validating channel access and uploaded attachments", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {});

        const response = await requestText(harness.app, {
            method: "POST",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(harness.getPermissionCalls, [["viewer", "333333333333333333", "111111111111111111"]]);
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL", "ATTACH_FILES"]);
        assert.equal(harness.cloudAttachmentFindOptions.length, 1);
    });
});

describe("DELETE /attachments/sender-report-false-positive", () => {
    test("declares authenticated empty response metadata", (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {});

        assert.deepEqual(harness.deleteRouteOptions, {
            requestBody: "AttachmentSenderFalsePositiveReportSchema",
            coerceRequestBody: false,
            summary: "Delete Sent Explicit Content False Positive Report",
            description: "Deletes a sent explicit content false-positive report when explicit-media feedback persistence is available.",
            responses: emptyResponseMetadata(),
        });
    });

    test("returns Discord-compatible 204 empty response for a validated sent report identifier", async (t) => {
        const harness = setupAttachmentSenderFalsePositiveRoute(t, {});

        const response = await requestText(harness.app, {
            method: "DELETE",
            body: JSON.stringify(reportBody()),
            headers: { "content-type": "application/json" },
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, "");
        assert.deepEqual(harness.permissionChecks, ["VIEW_CHANNEL", "ATTACH_FILES"]);
    });
});

describe("generated route artifacts for /attachments/sender-report-false-positive", () => {
    test("source route catalog contains DELETE and POST for the exact sender path", () => {
        const catalogPath = path.join(process.cwd(), "packages", "automatic-reverse-engineering", "data", "catalogs", "routes.source.catalog.json");
        const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Array<{
            method: string;
            route: string;
            request_schema_ref?: string;
            source: string;
        }>;

        const entries = catalog.filter((entry) => entry.route === "/attachments/sender-report-false-positive");
        assert.deepEqual(entries.map((entry) => entry.method).sort(), ["DELETE", "POST"]);
        assert.ok(entries.every((entry) => entry.source === "src/api/routes/attachments/sender-report-false-positive.ts"));
        assert.ok(entries.every((entry) => entry.request_schema_ref === "AttachmentSenderFalsePositiveReportSchema"));
    });
});

type TestChannel = {
    id: string;
    guild_id?: string;
};

type TestCloudAttachment = {
    channelId?: string;
    userId?: string;
    userAttachmentId?: string;
    userFilename: string;
};

type SetupOptions = {
    channel?: TestChannel | null;
    cloudAttachments?: TestCloudAttachment[];
    missingPermissions?: string[];
};

function setupAttachmentSenderFalsePositiveRoute(t: TestContext, options: SetupOptions) {
    process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../util/handlers/route");
    const errorHandlerModule = requireModule(distModulePath("api", "middlewares", "ErrorHandler.js")) as typeof import("../../middlewares/ErrorHandler");
    const permissionsModule = requireModule(distModulePath("util", "util", "Permissions.js")) as typeof import("../../../util/util/Permissions");
    const util = requireModule("@spacebar/util") as typeof import("@spacebar/util");

    const routeOptions: unknown[] = [];
    const channelFindOptions: unknown[] = [];
    const cloudAttachmentFindOptions: unknown[] = [];
    const getPermissionCalls: unknown[] = [];
    const permissionChecks: string[] = [];
    const missingPermissions = new Set(options.missingPermissions ?? []);
    const channel =
        options.channel === undefined
            ? {
                  id: "111111111111111111",
                  guild_id: "333333333333333333",
              }
            : options.channel;
    const cloudAttachments = options.cloudAttachments ?? [
        {
            channelId: "111111111111111111",
            userId: "viewer",
            userAttachmentId: "444444444444444444",
            userFilename: "image.png",
        },
    ];

    t.mock.method(routeHandler, "route", (routeOption: unknown) => {
        routeOptions.push(routeOption);
        return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
    });
    t.mock.method(util.Channel, "findOne", async (findOptions: unknown) => {
        channelFindOptions.push(findOptions);
        return channel;
    });
    t.mock.method(util.CloudAttachment, "find", async (findOptions: unknown) => {
        cloudAttachmentFindOptions.push(findOptions);
        return cloudAttachments;
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
    const router = (requireModule(routeModulePath) as typeof import("./sender-report-false-positive")).default as express.Router;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = "viewer";
        next();
    });
    app.use("/attachments/sender-report-false-positive", router);
    app.use(errorHandlerModule.ErrorHandler);

    return {
        app,
        get deleteRouteOptions() {
            return routeOptions[0];
        },
        get postRouteOptions() {
            return routeOptions[1];
        },
        get channelFindOptions() {
            return channelFindOptions;
        },
        get cloudAttachmentFindOptions() {
            return cloudAttachmentFindOptions;
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
        filenames: ["image.png"],
        ...overrides,
    };
}

async function requestText(app: express.Express, init: RequestInit): Promise<{ status: number; body: string }> {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}/attachments/sender-report-false-positive`, init);

        return {
            status: response.status,
            body: await response.text(),
        };
    } finally {
        server.close();
    }
}
