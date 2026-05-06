import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canSeeActiveThread, filterVisibleActiveThreads, GUILD_PRIVATE_THREAD, GUILD_PUBLIC_THREAD, isActiveThread } from "./ActiveThreads";

describe("active thread visibility", () => {
    test("treats only unarchived threads as active", () => {
        assert.equal(isActiveThread({ id: "1", type: GUILD_PUBLIC_THREAD, thread_metadata: { archived: false } }), true);
        assert.equal(isActiveThread({ id: "2", type: GUILD_PUBLIC_THREAD, thread_metadata: { archived: true } }), false);
        assert.equal(isActiveThread({ id: "3", type: GUILD_PUBLIC_THREAD }), false);
    });

    test("allows public active threads without membership", () => {
        assert.equal(canSeeActiveThread({ id: "1", type: GUILD_PUBLIC_THREAD, thread_metadata: { archived: false } }, new Set(), false), true);
    });

    test("requires membership or manage permission for private active threads", () => {
        const thread = { id: "1", type: GUILD_PRIVATE_THREAD, thread_metadata: { archived: false } };

        assert.equal(canSeeActiveThread(thread, new Set(), false), false);
        assert.equal(canSeeActiveThread(thread, new Set(["1"]), false), true);
        assert.equal(canSeeActiveThread(thread, new Set(), true), true);
    });

    test("filters mixed active thread lists", () => {
        const threads = [
            { id: "public", type: GUILD_PUBLIC_THREAD, thread_metadata: { archived: false } },
            { id: "archived", type: GUILD_PUBLIC_THREAD, thread_metadata: { archived: true } },
            { id: "private", type: GUILD_PRIVATE_THREAD, thread_metadata: { archived: false } },
        ];

        assert.deepEqual(
            filterVisibleActiveThreads(threads, new Set(["private"]), false).map((thread) => thread.id),
            ["public", "private"],
        );
    });
});
