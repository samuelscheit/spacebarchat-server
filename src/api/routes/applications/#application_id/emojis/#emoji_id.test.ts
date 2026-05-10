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
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, test, type TestContext } from "node:test";
import express, { type NextFunction, type Request, type Response } from "express";
import { DiscordApiErrors } from "@spacebar/util";
import {
    createApplicationEmojiRouter,
    deleteApplicationEmoji,
    getApplicationEmoji,
    updateApplicationEmoji,
    type ApplicationEmojiRecord,
    type ApplicationEmojiRepositories,
} from "./#emoji_id";

const requireModule = require;
const routeModulePath = require.resolve("./#emoji_id");

const uploader = {
    id: "uploader",
    username: "Uploader",
    discriminator: "0001",
    avatar: null,
};
const applicationId = "100000000000000001";
const missingApplicationId = "100000000000000002";
const emojiId = "100000000000000003";
const missingEmojiId = "100000000000000004";

afterEach(() => {
    delete require.cache[routeModulePath];
});

function distModulePath(...segments: string[]) {
    return path.join(process.cwd(), "dist", ...segments);
}

function createApp(userId: string, repositories: ApplicationEmojiRepositories) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user_id = userId;
        req.t = ((key: string) => key) as express.Request["t"];
        next();
    });
    app.use("/applications/:application_id/emojis/:emoji_id", createApplicationEmojiRouter(repositories));
    app.use(
        (error: { code?: number | string; httpStatus?: number; message?: string; errors?: unknown }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            res.status(error.httpStatus ?? 400).json({
                code: error.code,
                message: error.message,
                ...(error.errors ? { errors: error.errors } : {}),
            });
        },
    );

    return app;
}

async function requestJson(app: express.Express, requestPath: string, init: { method?: string; body?: unknown } = {}) {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected HTTP server to listen on a TCP port");
    const port = (address as AddressInfo).port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
            method: init.method,
            headers: init.body === undefined ? undefined : { "content-type": "application/json" },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
        const responseText = await response.text();
        const body = responseText ? (JSON.parse(responseText) as unknown) : undefined;
        return { status: response.status, body };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

function createAuthorizedApplicationRepository(t: TestContext, application = { owner: { id: "owner" }, bot: { id: "bot" } }) {
    return {
        findOne: t.mock.fn(async (_options: unknown) => application),
    };
}

function createApplicationEmojiRepository(t: TestContext, initialEmoji: ApplicationEmojiRecord | null) {
    let storedEmoji = initialEmoji ? { ...initialEmoji } : null;

    const repository = {
        findOne: t.mock.fn(async (_options: unknown) => (storedEmoji ? { ...storedEmoji } : null)),
        save: t.mock.fn(async (emoji: ApplicationEmojiRecord) => {
            const savedEmoji = { ...emoji };
            storedEmoji = savedEmoji;
            return savedEmoji;
        }),
        delete: t.mock.fn(async (_criteria: unknown) => {
            storedEmoji = null;
            return { affected: 1 };
        }),
        get storedEmoji() {
            return storedEmoji;
        },
    };

    return repository;
}

function setupRouteMetadataHarness(t: TestContext) {
    const routeHandler = requireModule(distModulePath("api", "util", "handlers", "route.js")) as typeof import("../../../../util/handlers/route");
    const routeOptions: unknown[] = [];

    t.mock.method(routeHandler, "route", (options: unknown) => {
        routeOptions.push(options);
        return (_req: Request, _res: Response, next: NextFunction) => next();
    });

    delete require.cache[routeModulePath];
    requireModule(routeModulePath);

    return routeOptions;
}

describe("GET /applications/:application_id/emojis/:emoji_id", () => {
    test("declares authenticated GET, PATCH, and DELETE metadata for the application emoji detail route", (t) => {
        assert.deepEqual(setupRouteMetadataHarness(t), [
            {
                responses: {
                    200: {
                        body: "EmojiResponse",
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
            },
            {
                requestBody: "ApplicationEmojiModifySchema",
                responses: {
                    200: {
                        body: "EmojiResponse",
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
            },
            {
                responses: {
                    204: {},
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
            },
        ]);
    });

    test("returns the stored application emoji with source-backed application emoji constants", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                id: emojiId,
                name: "wave",
                animated: true,
                user: uploader,
            })),
        };

        assert.deepEqual(await getApplicationEmoji(applicationId, emojiId, "owner", { applicationRepository, emojiRepository }), {
            id: emojiId,
            name: "wave",
            user: uploader,
            require_colons: true,
            managed: false,
            animated: true,
            available: true,
        });
        assert.deepEqual(emojiRepository.findOne.mock.calls[0].arguments[0], {
            where: {
                id: emojiId,
                application_id: applicationId,
            },
            relations: {
                user: true,
            },
        });
    });

    test("returns null for a known application without a matching application emoji", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        assert.equal(await getApplicationEmoji(applicationId, missingEmojiId, "owner", { applicationRepository, emojiRepository }), null);
    });

    test("rejects unknown applications before querying application emojis", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("emoji lookup should not run for unknown applications");
            }),
        };

        await assert.rejects(
            () => getApplicationEmoji(missingApplicationId, emojiId, "owner", { applicationRepository, emojiRepository }),
            (error) =>
                (error as { code?: unknown; message?: unknown }).code === DiscordApiErrors.UNKNOWN_APPLICATION.code &&
                (error as { code?: unknown; message?: unknown }).message === DiscordApiErrors.UNKNOWN_APPLICATION.message,
        );
        assert.equal(emojiRepository.findOne.mock.callCount(), 0);
    });

    test("returns the application emoji from the mounted route for an application bot", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" }, bot: { id: "bot" } })),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({
                id: emojiId,
                name: "party",
                animated: false,
                user: uploader,
            })),
        };

        const response = await requestJson(createApp("bot", { applicationRepository, emojiRepository }), `/applications/${applicationId}/emojis/${emojiId}`);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: emojiId,
            name: "party",
            user: uploader,
            require_colons: true,
            managed: false,
            animated: false,
            available: true,
        });
    });

    test("returns 404 for missing application emojis", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };

        const response = await requestJson(createApp("owner", { applicationRepository, emojiRepository }), `/applications/${applicationId}/emojis/${missingEmojiId}`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_EMOJI.code,
            message: DiscordApiErrors.UNKNOWN_EMOJI.message,
        });
    });

    test("returns 403 for callers without application emoji access", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("emoji lookup should not run before authorization");
            }),
        };

        const response = await requestJson(createApp("intruder", { applicationRepository, emojiRepository }), `/applications/${applicationId}/emojis/${emojiId}`);

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(emojiRepository.findOne.mock.callCount(), 0);
    });

    test("returns 404 for unknown applications", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("emoji lookup should not run for unknown applications");
            }),
        };

        const response = await requestJson(createApp("owner", { applicationRepository, emojiRepository }), `/applications/${missingApplicationId}/emojis/${emojiId}`);

        assert.equal(response.status, 404);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(emojiRepository.findOne.mock.callCount(), 0);
    });
});

describe("PATCH /applications/:application_id/emojis/:emoji_id", () => {
    test("renames the stored application emoji and returns the updated emoji response", async (t) => {
        const applicationRepository = createAuthorizedApplicationRepository(t);
        const emojiRepository = createApplicationEmojiRepository(t, {
            id: emojiId,
            application_id: applicationId,
            name: "wave",
            animated: false,
            user: uploader,
        });

        const response = await requestJson(createApp("owner", { applicationRepository, emojiRepository }), `/applications/${applicationId}/emojis/${emojiId}`, {
            method: "PATCH",
            body: { name: "party_blob" },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, {
            id: emojiId,
            name: "party_blob",
            user: uploader,
            require_colons: true,
            managed: false,
            animated: false,
            available: true,
        });
        assert.equal(emojiRepository.storedEmoji?.name, "party_blob");
        assert.equal(emojiRepository.save.mock.callCount(), 1);
        assert.deepEqual(emojiRepository.findOne.mock.calls[0].arguments[0], {
            where: {
                id: emojiId,
                application_id: applicationId,
            },
            relations: {
                user: true,
            },
        });
    });

    test("persists the same update through the route helper", async (t) => {
        const applicationRepository = createAuthorizedApplicationRepository(t);
        const emojiRepository = createApplicationEmojiRepository(t, {
            id: emojiId,
            application_id: applicationId,
            name: "before",
            animated: true,
            user: uploader,
        });

        assert.deepEqual(await updateApplicationEmoji(applicationId, emojiId, "owner", { name: "after" }, { applicationRepository, emojiRepository }), {
            id: emojiId,
            name: "after",
            user: uploader,
            require_colons: true,
            managed: false,
            animated: true,
            available: true,
        });
        assert.equal(emojiRepository.storedEmoji?.name, "after");
    });

    test("rejects unsupported role updates and invalid names before persistence", async (t) => {
        const applicationRepository = createAuthorizedApplicationRepository(t);
        const emojiRepository = createApplicationEmojiRepository(t, {
            id: emojiId,
            application_id: applicationId,
            name: "wave",
            animated: false,
            user: uploader,
        });
        const app = createApp("owner", { applicationRepository, emojiRepository });

        const rolesResponse = await requestJson(app, `/applications/${applicationId}/emojis/${emojiId}`, {
            method: "PATCH",
            body: { roles: ["100000000000000005"] },
        });
        const nameResponse = await requestJson(app, `/applications/${applicationId}/emojis/${emojiId}`, {
            method: "PATCH",
            body: { name: "a" },
        });

        assert.equal(rolesResponse.status, 400);
        assert.equal(nameResponse.status, 400);
        assert.equal(emojiRepository.save.mock.callCount(), 0);
        assert.equal((rolesResponse.body as { code?: unknown }).code, 50035);
        assert.equal((nameResponse.body as { code?: unknown }).code, 50035);
    });

    test("returns 403 before persistence for callers without application emoji access", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("emoji lookup should not run before authorization");
            }),
            save: t.mock.fn(async (emoji: ApplicationEmojiRecord) => emoji),
        };

        const response = await requestJson(createApp("intruder", { applicationRepository, emojiRepository }), `/applications/${applicationId}/emojis/${emojiId}`, {
            method: "PATCH",
            body: { name: "party" },
        });

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(emojiRepository.findOne.mock.callCount(), 0);
        assert.equal(emojiRepository.save.mock.callCount(), 0);
    });

    test("returns 404 for unknown applications and missing application emojis", async (t) => {
        const missingApplicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const skippedEmojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("emoji lookup should not run for unknown applications");
            }),
            save: t.mock.fn(async (emoji: ApplicationEmojiRecord) => emoji),
        };
        const missingApplicationResponse = await requestJson(
            createApp("owner", { applicationRepository: missingApplicationRepository, emojiRepository: skippedEmojiRepository }),
            `/applications/${missingApplicationId}/emojis/${emojiId}`,
            {
                method: "PATCH",
                body: { name: "party" },
            },
        );

        const applicationRepository = createAuthorizedApplicationRepository(t);
        const emojiRepository = createApplicationEmojiRepository(t, null);
        const missingEmojiResponse = await requestJson(createApp("owner", { applicationRepository, emojiRepository }), `/applications/${applicationId}/emojis/${missingEmojiId}`, {
            method: "PATCH",
            body: { name: "party" },
        });

        assert.equal(missingApplicationResponse.status, 404);
        assert.deepEqual(missingApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(skippedEmojiRepository.findOne.mock.callCount(), 0);
        assert.equal(skippedEmojiRepository.save.mock.callCount(), 0);

        assert.equal(missingEmojiResponse.status, 404);
        assert.deepEqual(missingEmojiResponse.body, {
            code: DiscordApiErrors.UNKNOWN_EMOJI.code,
            message: DiscordApiErrors.UNKNOWN_EMOJI.message,
        });
        assert.equal(emojiRepository.save.mock.callCount(), 0);
    });

    test("validates route parameters before mutating application emoji storage", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("application lookup should not run for malformed application ids");
            }),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("emoji lookup should not run for malformed ids");
            }),
            save: t.mock.fn(async (emoji: ApplicationEmojiRecord) => emoji),
        };
        const invalidApplicationResponse = await requestJson(
            createApp("owner", { applicationRepository, emojiRepository }),
            "/applications/not-a-snowflake/emojis/100000000000000003",
            {
                method: "PATCH",
                body: { name: "party" },
            },
        );

        const authorizedApplicationRepository = createAuthorizedApplicationRepository(t);
        const invalidEmojiResponse = await requestJson(
            createApp("owner", { applicationRepository: authorizedApplicationRepository, emojiRepository }),
            `/applications/${applicationId}/emojis/not-a-snowflake`,
            {
                method: "PATCH",
                body: { name: "party" },
            },
        );

        assert.equal(invalidApplicationResponse.status, 404);
        assert.deepEqual(invalidApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(applicationRepository.findOne.mock.callCount(), 0);

        assert.equal(invalidEmojiResponse.status, 404);
        assert.deepEqual(invalidEmojiResponse.body, {
            code: DiscordApiErrors.UNKNOWN_EMOJI.code,
            message: DiscordApiErrors.UNKNOWN_EMOJI.message,
        });
        assert.equal(emojiRepository.findOne.mock.callCount(), 0);
        assert.equal(emojiRepository.save.mock.callCount(), 0);
    });
});

describe("DELETE /applications/:application_id/emojis/:emoji_id", () => {
    test("deletes the stored application emoji and returns 204", async (t) => {
        const applicationRepository = createAuthorizedApplicationRepository(t);
        const emojiRepository = createApplicationEmojiRepository(t, {
            id: emojiId,
            application_id: applicationId,
            name: "wave",
            animated: false,
            user: uploader,
        });

        const response = await requestJson(createApp("owner", { applicationRepository, emojiRepository }), `/applications/${applicationId}/emojis/${emojiId}`, {
            method: "DELETE",
        });

        assert.equal(response.status, 204);
        assert.equal(response.body, undefined);
        assert.equal(emojiRepository.storedEmoji, null);
        assert.deepEqual(emojiRepository.delete.mock.calls[0].arguments[0], {
            id: emojiId,
            application_id: applicationId,
        });
    });

    test("deletes through the route helper without returning an emoji body", async (t) => {
        const applicationRepository = createAuthorizedApplicationRepository(t);
        const emojiRepository = createApplicationEmojiRepository(t, {
            id: emojiId,
            application_id: applicationId,
            name: "wave",
            animated: false,
            user: uploader,
        });

        assert.equal(await deleteApplicationEmoji(applicationId, emojiId, "owner", { applicationRepository, emojiRepository }), true);
        assert.equal(emojiRepository.storedEmoji, null);
    });

    test("returns 403 before deleting for callers without application emoji access", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => ({ owner: { id: "owner" } })),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("emoji lookup should not run before authorization");
            }),
            delete: t.mock.fn(async (_criteria: unknown) => ({ affected: 0 })),
        };

        const response = await requestJson(createApp("intruder", { applicationRepository, emojiRepository }), `/applications/${applicationId}/emojis/${emojiId}`, {
            method: "DELETE",
        });

        assert.equal(response.status, 403);
        assert.deepEqual(response.body, {
            code: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.code,
            message: DiscordApiErrors.ACTION_NOT_AUTHORIZED_ON_APPLICATION.message,
        });
        assert.equal(emojiRepository.findOne.mock.callCount(), 0);
        assert.equal(emojiRepository.delete.mock.callCount(), 0);
    });

    test("returns 404 for unknown applications and missing application emojis", async (t) => {
        const missingApplicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => null),
        };
        const skippedEmojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("emoji lookup should not run for unknown applications");
            }),
            delete: t.mock.fn(async (_criteria: unknown) => ({ affected: 0 })),
        };
        const missingApplicationResponse = await requestJson(
            createApp("owner", { applicationRepository: missingApplicationRepository, emojiRepository: skippedEmojiRepository }),
            `/applications/${missingApplicationId}/emojis/${emojiId}`,
            {
                method: "DELETE",
            },
        );

        const applicationRepository = createAuthorizedApplicationRepository(t);
        const emojiRepository = createApplicationEmojiRepository(t, null);
        const missingEmojiResponse = await requestJson(createApp("owner", { applicationRepository, emojiRepository }), `/applications/${applicationId}/emojis/${missingEmojiId}`, {
            method: "DELETE",
        });

        assert.equal(missingApplicationResponse.status, 404);
        assert.deepEqual(missingApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(skippedEmojiRepository.findOne.mock.callCount(), 0);
        assert.equal(skippedEmojiRepository.delete.mock.callCount(), 0);

        assert.equal(missingEmojiResponse.status, 404);
        assert.deepEqual(missingEmojiResponse.body, {
            code: DiscordApiErrors.UNKNOWN_EMOJI.code,
            message: DiscordApiErrors.UNKNOWN_EMOJI.message,
        });
        assert.equal(emojiRepository.delete.mock.callCount(), 0);
    });

    test("validates route parameters before deleting application emoji storage", async (t) => {
        const applicationRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("application lookup should not run for malformed application ids");
            }),
        };
        const emojiRepository = {
            findOne: t.mock.fn(async (_options: unknown) => {
                throw new Error("emoji lookup should not run for malformed ids");
            }),
            delete: t.mock.fn(async (_criteria: unknown) => ({ affected: 0 })),
        };
        const invalidApplicationResponse = await requestJson(
            createApp("owner", { applicationRepository, emojiRepository }),
            "/applications/not-a-snowflake/emojis/100000000000000003",
            {
                method: "DELETE",
            },
        );

        const authorizedApplicationRepository = createAuthorizedApplicationRepository(t);
        const invalidEmojiResponse = await requestJson(
            createApp("owner", { applicationRepository: authorizedApplicationRepository, emojiRepository }),
            `/applications/${applicationId}/emojis/not-a-snowflake`,
            {
                method: "DELETE",
            },
        );

        assert.equal(invalidApplicationResponse.status, 404);
        assert.deepEqual(invalidApplicationResponse.body, {
            code: DiscordApiErrors.UNKNOWN_APPLICATION.code,
            message: DiscordApiErrors.UNKNOWN_APPLICATION.message,
        });
        assert.equal(applicationRepository.findOne.mock.callCount(), 0);

        assert.equal(invalidEmojiResponse.status, 404);
        assert.deepEqual(invalidEmojiResponse.body, {
            code: DiscordApiErrors.UNKNOWN_EMOJI.code,
            message: DiscordApiErrors.UNKNOWN_EMOJI.message,
        });
        assert.equal(emojiRepository.findOne.mock.callCount(), 0);
        assert.equal(emojiRepository.delete.mock.callCount(), 0);
    });
});
