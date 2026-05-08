import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, test, type TestContext } from "node:test";
import express from "express";
import {
    getRecentAvatarIdsToPrune,
    getRecentAvatarStorageHashesToDelete,
    getUserRecentAvatarHash,
    pruneUserRecentAvatars,
    RECENT_AVATAR_LIMIT,
    toRecentAvatarResponse,
    withCurrentAvatarFallback,
} from "./RecentAvatars";

const validPngDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

describe("recent avatars", () => {
    test("serializes persisted recent avatar records", () => {
        assert.deepEqual(toRecentAvatarResponse({ id: "avatar-id", storage_hash: "avatar-hash", description: "Uploaded avatar" }), {
            id: "avatar-id",
            storage_hash: "avatar-hash",
            description: "Uploaded avatar",
        });
    });

    test("preserves persisted descriptions and distinct avatar ids", () => {
        assert.deepEqual(withCurrentAvatarFallback([{ id: "avatar-id", storage_hash: "avatar-hash", description: "Uploaded avatar" }], "avatar-hash"), [
            {
                id: "avatar-id",
                storage_hash: "avatar-hash",
                description: "Uploaded avatar",
            },
        ]);
    });

    test("adds a legacy current avatar fallback when no recent row matches", () => {
        assert.deepEqual(withCurrentAvatarFallback([{ id: "old-id", storage_hash: "old-hash" }], "current-hash"), [
            {
                id: "current-hash",
                storage_hash: "current-hash",
                description: null,
            },
            {
                id: "old-id",
                storage_hash: "old-hash",
                description: null,
            },
        ]);
    });

    test("limits recent avatars to six newest entries", () => {
        const avatars = Array.from({ length: RECENT_AVATAR_LIMIT + 1 }, (_, index) => ({
            id: `avatar-${index}`,
            storage_hash: `hash-${index}`,
        }));

        assert.deepEqual(
            withCurrentAvatarFallback(avatars, null).map((avatar) => avatar.id),
            ["avatar-0", "avatar-1", "avatar-2", "avatar-3", "avatar-4", "avatar-5"],
        );
        assert.deepEqual(getRecentAvatarIdsToPrune(avatars), ["avatar-6"]);
    });

    test("selects only pruned avatar blobs that are not still retained", () => {
        const avatars = [
            ...Array.from({ length: RECENT_AVATAR_LIMIT }, (_, index) => ({
                id: `retained-avatar-${index}`,
                storage_hash: index === 0 ? "shared-hash" : `retained-hash-${index}`,
            })),
            { id: "pruned-duplicate", storage_hash: "shared-hash" },
            { id: "pruned-unique", storage_hash: "old-hash" },
            { id: "pruned-unique-again", storage_hash: "old-hash" },
        ];

        assert.deepEqual(getRecentAvatarIdsToPrune(avatars), ["pruned-duplicate", "pruned-unique", "pruned-unique-again"]);
        assert.deepEqual(getRecentAvatarStorageHashesToDelete(avatars), ["old-hash"]);
    });

    test("recent avatar route returns persisted avatars with descriptions", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const { User, UserRecentAvatar } = require("@spacebar/util") as typeof import("@spacebar/util");
        const routeModulePath = require.resolve("../../routes/users/@me/avatars");
        delete require.cache[routeModulePath];

        t.mock.method(User, "findOneOrFail", async () => ({ avatar: "hash-current" }));
        t.mock.method(UserRecentAvatar, "find", async () => [
            {
                id: "avatar-id",
                storage_hash: "hash-current",
                description: "Avatar, added May 6, 2026 at 11:04 AM",
            },
        ]);

        try {
            const router = require(routeModulePath).default as express.Router;
            const app = createUserRouteApp(router, "/users/@me/avatars");
            const response = await requestJson(app, "/users/@me/avatars");

            assert.equal(response.status, 200);
            assert.deepEqual(response.body, {
                avatars: [
                    {
                        id: "avatar-id",
                        storage_hash: "hash-current",
                        description: "Avatar, added May 6, 2026 at 11:04 AM",
                    },
                ],
            });
        } finally {
            delete require.cache[routeModulePath];
        }
    });

    test("modify current user route records uploaded avatar descriptions", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const { User, UserRecentAvatar } = util;
        const routeModulePath = require.resolve("../../routes/users/@me/index");
        delete require.cache[routeModulePath];

        const getAssignedBody = mockCurrentUserLookup(t, User);
        let createdAvatarPayload: Record<string, unknown> | undefined;
        const avatarData = validPngDataUri;
        const originalFetch = globalThis.fetch;
        const config = new util.ConfigValue();
        config.cdn.endpointPrivate = "http://cdn.test";

        t.mock.method(util.Config, "get", () => config);
        t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
            if (String(url).endsWith("/avatars/user-id")) {
                return new Response(JSON.stringify({ id: "uploaded-avatar-hash" }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            }

            return originalFetch(url, init);
        });
        t.mock.method(UserRecentAvatar, "create", (payload: Record<string, unknown>) => {
            createdAvatarPayload = payload;
            return {
                ...payload,
                id: "recent-avatar-id",
                async save() {},
            };
        });
        t.mock.method(UserRecentAvatar, "find", async () => [{ id: "recent-avatar-id" }]);
        t.mock.method(UserRecentAvatar, "delete", async () => undefined);

        try {
            const router = require(routeModulePath).default as express.Router;
            const app = createUserRouteApp(router);
            const response = await requestJson(app, "/users/@me", {
                method: "PATCH",
                body: {
                    avatar: avatarData,
                    avatar_description: "Avatar, added May 6, 2026 at 11:04 AM",
                    bio: "hello",
                },
            });

            assert.equal(response.status, 200);
            assert.deepEqual(getAssignedBody(), {
                avatar: "uploaded-avatar-hash",
                bio: "hello",
            });
            assert.deepEqual(createdAvatarPayload, {
                user_id: "user-id",
                storage_hash: "uploaded-avatar-hash",
                description: "Avatar, added May 6, 2026 at 11:04 AM",
            });
        } finally {
            delete require.cache[routeModulePath];
        }
    });

    test("modify current user route accepts avatar metadata without assigning it to the user entity", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const { User, UserRecentAvatar } = util;
        const routeModulePath = require.resolve("../../routes/users/@me/index");
        delete require.cache[routeModulePath];

        const getAssignedBody = mockCurrentUserLookup(t, User);

        t.mock.method(UserRecentAvatar, "findOne", async () => ({ storage_hash: "stored-avatar-hash" }));

        try {
            const router = require(routeModulePath).default as express.Router;
            const app = createUserRouteApp(router);
            const response = await requestJson(app, "/users/@me", {
                method: "PATCH",
                body: {
                    avatar_id: "recent-avatar-id",
                    avatar_description: "should not be assigned",
                    bio: "hello",
                },
            });

            assert.equal(response.status, 200);
            assert.deepEqual(getAssignedBody(), {
                avatar: "stored-avatar-hash",
                bio: "hello",
            });
        } finally {
            delete require.cache[routeModulePath];
        }
    });

    test("rejects selecting an unknown recent avatar id", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const { UserRecentAvatar } = require("@spacebar/util") as typeof import("@spacebar/util");
        t.mock.method(UserRecentAvatar, "findOne", async (options: { where: { id: string; user_id: string } }) => {
            assert.deepEqual(options.where, {
                id: "other-avatar-id",
                user_id: "user-id",
            });
            return null;
        });

        await assert.rejects(getUserRecentAvatarHash("user-id", "other-avatar-id"), { code: 404 });
    });

    test("prunes stored avatars beyond the recent avatar limit and deletes orphaned blobs", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const { User, UserRecentAvatar } = util;
        const rows = Array.from({ length: RECENT_AVATAR_LIMIT + 2 }, (_, index) => ({ id: `avatar-${index}`, storage_hash: `hash-${index}` }));
        let deleteCriteria: { user_id: string; id: { value: string[] } } | undefined;
        const deletedFiles: string[] = [];

        t.mock.method(UserRecentAvatar, "find", async (options: { select: { id: boolean; storage_hash: boolean } }) => {
            assert.deepEqual(options.select, { id: true, storage_hash: true });
            return rows;
        });
        t.mock.method(User, "findOne", async () => ({ avatar: "current-avatar-hash" }));
        t.mock.method(UserRecentAvatar, "delete", async (criteria: { user_id: string; id: { _value: string[] } }) => {
            deleteCriteria = {
                user_id: criteria.user_id,
                id: {
                    value: criteria.id._value,
                },
            };
            return undefined;
        });
        t.mock.method(util, "deleteFile", async (path: string) => {
            deletedFiles.push(path);
            return { success: true };
        });

        await pruneUserRecentAvatars("user-id");

        assert.deepEqual(deleteCriteria, {
            user_id: "user-id",
            id: {
                value: ["avatar-6", "avatar-7"],
            },
        });
        assert.deepEqual(deletedFiles, ["/avatars/user-id/hash-6", "/avatars/user-id/hash-7"]);
    });

    test("does not delete pruned avatar blobs still referenced by retained or current avatars", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const { User, UserRecentAvatar } = util;
        const rows = [
            ...Array.from({ length: RECENT_AVATAR_LIMIT }, (_, index) => ({
                id: `avatar-${index}`,
                storage_hash: index === 0 ? "shared-hash" : `hash-${index}`,
            })),
            { id: "avatar-6", storage_hash: "shared-hash" },
            { id: "avatar-7", storage_hash: "old-hash" },
        ];
        const deletedFiles: string[] = [];

        t.mock.method(User, "findOne", async () => ({ avatar: "old-hash" }));
        t.mock.method(UserRecentAvatar, "find", async () => rows);
        t.mock.method(UserRecentAvatar, "delete", async () => undefined);
        t.mock.method(util, "deleteFile", async (path: string) => {
            deletedFiles.push(path);
            return { success: true };
        });

        await pruneUserRecentAvatars("user-id");

        assert.deepEqual(deletedFiles, []);
    });

    test("recording a new avatar protects it from prune-time deletion", async (t) => {
        process.env.DATABASE ??= "postgres://spacebar:spacebar@localhost:5432/spacebar_route_test";

        const util = require("@spacebar/util") as typeof import("@spacebar/util");
        const { User, UserRecentAvatar } = util;
        const rows = [
            ...Array.from({ length: RECENT_AVATAR_LIMIT }, (_, index) => ({
                id: `avatar-${index}`,
                storage_hash: `hash-${index}`,
            })),
            { id: "newly-recorded-avatar", storage_hash: "new-current-hash" },
        ];
        const deletedFiles: string[] = [];

        t.mock.method(User, "findOne", async () => {
            throw new Error("current user lookup should be skipped when current avatar hash is known");
        });
        t.mock.method(UserRecentAvatar, "find", async () => rows);
        t.mock.method(UserRecentAvatar, "delete", async () => undefined);
        t.mock.method(util, "deleteFile", async (path: string) => {
            deletedFiles.push(path);
            return { success: true };
        });

        await pruneUserRecentAvatars("user-id", RECENT_AVATAR_LIMIT, "new-current-hash");

        assert.deepEqual(deletedFiles, []);
    });
});

function mockCurrentUserLookup(t: TestContext, User: typeof import("@spacebar/util").User) {
    let assignedBody: Record<string, unknown> | undefined;

    class FakeUser {
        id = "user-id";
        username = "user";
        data?: { hash?: string; valid_tokens_since?: Date } = {};

        assign(body: Record<string, unknown>) {
            assignedBody = body;
            Object.assign(this, body);
            return this;
        }

        validate() {}

        async save() {}

        toPrivateUser() {
            return { ...this, data: undefined };
        }
    }

    t.mock.method(User, "findOneOrFail", async () => new FakeUser() as unknown as InstanceType<typeof User>);

    return () => assignedBody;
}

function createUserRouteApp(router: express.Router, mountPath = "/users/@me") {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const routeRequest = req as unknown as { user_id: string; t: (key: string) => string };
        routeRequest.user_id = "user-id";
        routeRequest.t = (key: string) => key;
        next();
    });
    app.use(mountPath, router);
    return app;
}

async function requestJson(app: express.Express, path: string, options: { method?: string; body?: unknown } = {}) {
    const server = app.listen(0);
    try {
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: options.method,
            body: options.body == undefined ? undefined : JSON.stringify(options.body),
            headers: options.body == undefined ? undefined : { "content-type": "application/json" },
        });

        return {
            status: response.status,
            body: await response.json(),
        };
    } finally {
        server.close();
    }
}
