import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { toMessageMentionUser } from "./MessageMentions";

describe("Message mention serialization", () => {
    test("projects mentioned users to partial message users", () => {
        const mention = toMessageMentionUser({
            id: "mentioned_user_id",
            username: "mentioned",
            discriminator: "0001",
            avatar: "avatar_hash",
            public_flags: 64,
            bio: "profile bio must not leak into message mentions",
            premium: true,
            premium_type: 2,
            created_at: new Date("2026-01-01T00:00:00.000Z"),
        });

        assert.deepEqual(mention, {
            id: "mentioned_user_id",
            username: "mentioned",
            discriminator: "0001",
            avatar: "avatar_hash",
            public_flags: 64,
        });
    });

    test("defaults missing avatars to null", () => {
        const mention = toMessageMentionUser({
            id: "mentioned_user_id",
            username: "mentioned",
            discriminator: "0001",
        });

        assert.equal(mention.avatar, null);
    });
});
