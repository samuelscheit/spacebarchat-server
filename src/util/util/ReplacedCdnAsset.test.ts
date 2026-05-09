import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deleteReplacedCdnAsset } from "./ReplacedCdnAsset";

describe("deleteReplacedCdnAsset", () => {
    test("deletes the previous hash below the mutation path when the asset changes", async () => {
        const deletedPaths: string[] = [];

        await deleteReplacedCdnAsset("/guilds/guild/users/user/avatars", "old-hash", "new-hash", {
            deleteAsset: async (path) => deletedPaths.push(path),
        });

        assert.deepEqual(deletedPaths, ["/guilds/guild/users/user/avatars/old-hash"]);
    });

    test("does not delete when there is no previous asset", async () => {
        const deletedPaths: string[] = [];

        await deleteReplacedCdnAsset("/guilds/guild/users/user/avatars", null, "new-hash", {
            deleteAsset: async (path) => deletedPaths.push(path),
        });

        assert.deepEqual(deletedPaths, []);
    });

    test("does not delete when the new upload reuses the same content hash", async () => {
        const deletedPaths: string[] = [];

        await deleteReplacedCdnAsset("/guilds/guild/users/user/avatars", "same-hash", "same-hash", {
            deleteAsset: async (path) => deletedPaths.push(path),
        });

        assert.deepEqual(deletedPaths, []);
    });

    test("deletes the previous asset when the profile field is cleared", async () => {
        const deletedPaths: string[] = [];

        await deleteReplacedCdnAsset("/guilds/guild/users/user/avatars", "old-hash", null, {
            deleteAsset: async (path) => deletedPaths.push(path),
        });

        assert.deepEqual(deletedPaths, ["/guilds/guild/users/user/avatars/old-hash"]);
    });

    test("logs and swallows stale delete failures", async () => {
        const error = new Error("already gone");
        const warnings: Array<[string, unknown]> = [];

        await assert.doesNotReject(() =>
            deleteReplacedCdnAsset("/guilds/guild/users/user/banners", "old-hash", "new-hash", {
                deleteAsset: async () => {
                    throw error;
                },
                logWarning: (message, warningError) => warnings.push([message, warningError]),
            }),
        );

        assert.equal(warnings.length, 1);
        assert.match(warnings[0][0], /\/guilds\/guild\/users\/user\/banners\/old-hash/);
        assert.equal(warnings[0][1], error);
    });
});
