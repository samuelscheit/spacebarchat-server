import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ChannelType } from "@spacebar/schemas/api/channels/Channel";
import { type ActiveThreadLike, canSeeActiveThread, filterVisibleActiveThreads, isActiveThread } from "./ActiveThreads";

describe("active thread visibility", () => {
    test("treats only unarchived threads as active", () => {
        assert.equal(
            isActiveThread({
                id: "1",
                type: ChannelType.GUILD_PUBLIC_THREAD,
                thread_metadata: {
                    archived: false,
                    auto_archive_duration: 4320,
                    archive_timestamp: new Date().toISOString(),
                    locked: false,
                    create_timestamp: new Date().toISOString(),
                },
            }),
            true,
        );
        assert.equal(isActiveThread({ id: "2", type: ChannelType.GUILD_PUBLIC_THREAD, thread_metadata: { archived: true } }), false);
        assert.equal(isActiveThread({ id: "3", type: ChannelType.GUILD_PUBLIC_THREAD }), false);
    });

    test("allows public active threads without membership", () => {
        assert.equal(canSeeActiveThread({ id: "1", type: ChannelType.GUILD_PUBLIC_THREAD, thread_metadata: { archived: false } }, new Set(), false), true);
    });

    test("requires membership, ownership, or manage permission for private active threads", () => {
        const thread: ActiveThreadLike = { id: "1", type: ChannelType.GUILD_PRIVATE_THREAD, owner_id: "owner", thread_metadata: { archived: false } };
        const ownerlessThread: ActiveThreadLike = { id: "2", type: ChannelType.GUILD_PRIVATE_THREAD, thread_metadata: { archived: false } };

        assert.equal(canSeeActiveThread(thread, new Set(), false), false);
        assert.equal(canSeeActiveThread(ownerlessThread, new Set(), false), false);
        assert.equal(canSeeActiveThread(thread, new Set(["1"]), false), true);
        assert.equal(canSeeActiveThread(thread, new Set(), true), true);
        assert.equal(canSeeActiveThread(thread, new Set(), false, "owner"), true);
    });

    test("filters mixed active thread lists", () => {
        const threads: ActiveThreadLike[] = [
            { id: "public", type: ChannelType.GUILD_PUBLIC_THREAD, thread_metadata: { archived: false } },
            { id: "archived", type: ChannelType.GUILD_PUBLIC_THREAD, thread_metadata: { archived: true } },
            { id: "private", type: ChannelType.GUILD_PRIVATE_THREAD, thread_metadata: { archived: false } },
            { id: "owned", type: ChannelType.GUILD_PRIVATE_THREAD, owner_id: "owner", thread_metadata: { archived: false } },
        ];

        assert.deepEqual(
            filterVisibleActiveThreads(threads, new Set(["private"]), false, "owner").map((thread) => thread.id),
            ["public", "private", "owned"],
        );
    });
});
