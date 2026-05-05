import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getRecentAvatarsFromCurrentAvatar, removeAvatarDescription } from "./RecentAvatars";

describe("recent avatars", () => {
    test("returns no recent avatars when the user has no current avatar", () => {
        assert.deepEqual(getRecentAvatarsFromCurrentAvatar(null), []);
    });

    test("exposes the current avatar in recent avatar response format", () => {
        assert.deepEqual(getRecentAvatarsFromCurrentAvatar("avatar-hash", "Uploaded avatar"), [
            {
                id: "avatar-hash",
                storage_hash: "avatar-hash",
                description: "Uploaded avatar",
            },
        ]);
    });

    test("strips avatar_description before assigning user fields", () => {
        assert.deepEqual(removeAvatarDescription({ avatar: "hash", avatar_description: "ignored" }), { avatar: "hash" });
    });
});
