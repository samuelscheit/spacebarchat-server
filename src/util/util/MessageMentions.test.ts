import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { serializeMessageMentions } from "./MessageMentions";

describe("Message mentions serializer", () => {
    test("returns an empty array when message mentions are not loaded", () => {
        assert.deepEqual(serializeMessageMentions(undefined), []);
        assert.deepEqual(serializeMessageMentions(null), []);
    });

    test("serializes mentioned users to public users", () => {
        const mentions = serializeMessageMentions([
            {
                toPublicUser: () => ({
                    id: "123",
                    username: "mentioned",
                }),
            },
        ]);

        assert.deepEqual(mentions, [
            {
                id: "123",
                username: "mentioned",
            },
        ]);
    });
});
