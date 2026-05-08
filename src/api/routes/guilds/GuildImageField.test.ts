import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deleteReplacedGuildImages, handleGuildImageField, saveGuildUpdateAndDeleteReplacedImages } from "./#guild_id/index";

describe("handleGuildImageField", () => {
    test("queues the previous CDN image after uploading a replacement", async () => {
        const calls: string[] = [];
        const replacedImagePaths: string[] = [];

        const result = await handleGuildImageField("/banners/guild-id", "data:image/png;base64,abc", "old-hash", {
            mutation: {
                uploadFile: async (path, body) => {
                    calls.push(`upload:${path}:${body}`);
                    return "new-hash";
                },
            },
            replacedImagePaths,
        });

        assert.equal(result, "new-hash");
        assert.deepEqual(calls, ["upload:/banners/guild-id:data:image/png;base64,abc"]);
        assert.deepEqual(replacedImagePaths, ["/banners/guild-id/old-hash"]);
    });

    test("keeps the current CDN image when an upload resolves to the same hash", async () => {
        const replacedImagePaths: string[] = [];

        const result = await handleGuildImageField("/banners/guild-id", "data:image/png;base64,abc", "same-hash", {
            mutation: {
                uploadFile: async () => "same-hash",
            },
            replacedImagePaths,
        });

        assert.equal(result, "same-hash");
        assert.deepEqual(replacedImagePaths, []);
    });

    test("queues the previous CDN image when the field is cleared", async () => {
        const replacedImagePaths: string[] = [];

        const result = await handleGuildImageField("/banners/guild-id", null, "old-hash", {
            mutation: {
                uploadFile: async () => {
                    throw new Error("clearing an image must not upload a replacement");
                },
            },
            replacedImagePaths,
        });

        assert.equal(result, null);
        assert.deepEqual(replacedImagePaths, ["/banners/guild-id/old-hash"]);
    });

    test("keeps the current CDN image when the hash is unchanged or the field is absent", async () => {
        const mutation = {
            uploadFile: async () => {
                throw new Error("unchanged or absent images must not upload");
            },
        };

        assert.equal(await handleGuildImageField("/banners/guild-id", "old-hash", "old-hash", { mutation }), "old-hash");
        assert.equal(await handleGuildImageField("/banners/guild-id", undefined, "old-hash", { mutation }), undefined);
    });

    test("deletes queued old CDN images", async () => {
        const deleted: string[] = [];

        await deleteReplacedGuildImages(["/banners/guild-id/old-hash"], async (path) => {
            deleted.push(path);
            return { success: true };
        });

        assert.deepEqual(deleted, ["/banners/guild-id/old-hash"]);
    });
});

describe("saveGuildUpdateAndDeleteReplacedImages", () => {
    test("deletes replaced images after saving and before emitting the update event", async () => {
        const calls: string[] = [];

        await saveGuildUpdateAndDeleteReplacedImages({
            saveGuild: async () => {
                calls.push("save");
            },
            replacedImagePaths: ["/banners/guild-id/old-hash"],
            deleteReplacedImages: async (paths) => {
                calls.push(`delete:${paths.join(",")}`);
            },
            emitGuildUpdate: async () => {
                calls.push("emit");
            },
        });

        assert.deepEqual(calls, ["save", "delete:/banners/guild-id/old-hash", "emit"]);
    });

    test("does not delete replaced images when saving fails", async () => {
        const calls: string[] = [];

        await assert.rejects(
            saveGuildUpdateAndDeleteReplacedImages({
                saveGuild: async () => {
                    calls.push("save");
                    throw new Error("save failed");
                },
                replacedImagePaths: ["/banners/guild-id/old-hash"],
                deleteReplacedImages: async () => {
                    calls.push("delete");
                },
                emitGuildUpdate: async () => {
                    calls.push("emit");
                },
            }),
            /save failed/,
        );

        assert.deepEqual(calls, ["save"]);
    });

    test("deletes replaced images after a successful save even when emitting fails", async () => {
        const calls: string[] = [];

        await assert.rejects(
            saveGuildUpdateAndDeleteReplacedImages({
                saveGuild: async () => {
                    calls.push("save");
                },
                replacedImagePaths: ["/banners/guild-id/old-hash"],
                deleteReplacedImages: async (paths) => {
                    calls.push(`delete:${paths.join(",")}`);
                },
                emitGuildUpdate: async () => {
                    calls.push("emit");
                    throw new Error("emit failed");
                },
            }),
            /emit failed/,
        );

        assert.deepEqual(calls, ["save", "delete:/banners/guild-id/old-hash", "emit"]);
    });
});
