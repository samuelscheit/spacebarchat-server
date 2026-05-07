import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACTIVE_GUILD_THREAD_TYPES, canAccessActiveGuildThread, filterAccessibleActiveGuildThreads, isActiveGuildThread, serializeActiveGuildThreads } from "./ActiveThreads";

describe("active guild thread utilities", () => {
    const viewParent = new Map([["parent", { has: (permission: string) => permission === "VIEW_CHANNEL" }]]);
    const manageParent = new Map([["parent", { has: (permission: string) => permission === "VIEW_CHANNEL" || permission === "MANAGE_THREADS" }]]);
    const hiddenParent = new Map([["parent", { has: () => false }]]);

    test("shares the route candidate thread types with the active thread predicate", () => {
        assert.deepEqual(ACTIVE_GUILD_THREAD_TYPES, [10, 11, 12]);
        for (const type of ACTIVE_GUILD_THREAD_TYPES) {
            assert.equal(
                isActiveGuildThread({ id: `${type}`, guild_id: "guild", parent_id: "parent", type, thread_metadata: { archived: false }, toJSON: () => ({}) }, "guild"),
                true,
            );
        }
    });

    test("identifies active threads in the requested guild", () => {
        assert.equal(isActiveGuildThread({ id: "1", guild_id: "guild", parent_id: "parent", type: 11, thread_metadata: { archived: false }, toJSON: () => ({}) }, "guild"), true);
        assert.equal(isActiveGuildThread({ id: "2", guild_id: "guild", parent_id: "parent", type: 11, thread_metadata: { archived: true }, toJSON: () => ({}) }, "guild"), false);
        assert.equal(isActiveGuildThread({ id: "3", guild_id: "other", parent_id: "parent", type: 11, thread_metadata: { archived: false }, toJSON: () => ({}) }, "guild"), false);
        assert.equal(isActiveGuildThread({ id: "4", guild_id: "guild", parent_id: "parent", type: 0, thread_metadata: { archived: false }, toJSON: () => ({}) }, "guild"), false);
    });

    test("allows visible public threads even when the requester has not joined", () => {
        assert.equal(
            canAccessActiveGuildThread(
                { id: "public", guild_id: "guild", parent_id: "parent", type: 11, thread_metadata: { archived: false }, toJSON: () => ({}) },
                "guild",
                new Set(),
                viewParent,
            ),
            true,
        );
    });

    test("requires parent channel visibility", () => {
        assert.equal(
            canAccessActiveGuildThread(
                { id: "public", guild_id: "guild", parent_id: "parent", type: 11, thread_metadata: { archived: false }, toJSON: () => ({}) },
                "guild",
                new Set(),
                hiddenParent,
            ),
            false,
        );

        assert.equal(
            canAccessActiveGuildThread(
                { id: "orphan", guild_id: "guild", parent_id: null, type: 11, thread_metadata: { archived: false }, toJSON: () => ({}) },
                "guild",
                new Set(),
                viewParent,
            ),
            false,
        );
    });

    test("requires membership or manage threads for private threads", () => {
        const privateThread = { id: "private", guild_id: "guild", parent_id: "parent", type: 12, thread_metadata: { archived: false }, toJSON: () => ({}) };

        assert.equal(canAccessActiveGuildThread(privateThread, "guild", new Set(), viewParent), false);
        assert.equal(canAccessActiveGuildThread(privateThread, "guild", new Set(["private"]), viewParent), true);
        assert.equal(canAccessActiveGuildThread(privateThread, "guild", new Set(), manageParent), true);
    });

    test("filters accessible active guild threads", () => {
        const threads = filterAccessibleActiveGuildThreads(
            [
                { id: "public", guild_id: "guild", parent_id: "parent", type: 11, thread_metadata: { archived: false }, toJSON: () => ({ id: "public" }) },
                { id: "private", guild_id: "guild", parent_id: "parent", type: 12, thread_metadata: { archived: false }, toJSON: () => ({ id: "private" }) },
                { id: "archived", guild_id: "guild", parent_id: "parent", type: 11, thread_metadata: { archived: true }, toJSON: () => ({ id: "archived" }) },
            ],
            "guild",
            new Set(["private"]),
            viewParent,
        );

        assert.deepEqual(
            threads.map((thread) => thread.id),
            ["public", "private"],
        );
    });

    test("serializes returned threads and only matching requester memberships", () => {
        const response = serializeActiveGuildThreads(
            [
                { id: "public", guild_id: "guild", parent_id: "parent", type: 11, thread_metadata: { archived: false }, toJSON: () => ({ id: "public" }) },
                { id: "private", guild_id: "guild", parent_id: "parent", type: 12, thread_metadata: { archived: false }, toJSON: () => ({ id: "private" }) },
            ],
            [
                {
                    id: "private",
                    toJSON: () => ({
                        id: "private",
                        index: "internal",
                        member_idx: "member-index",
                        join_timestamp: "2026-01-01T00:00:00.000Z",
                        muted: false,
                        mute_config: null,
                        flags: 0,
                    }),
                },
                { id: "hidden", toJSON: () => ({ id: "hidden", member_idx: "member-index", join_timestamp: "2026-01-01T00:00:00.000Z", flags: 0 }) },
            ],
            "user",
        );

        assert.deepEqual(response, {
            threads: [{ id: "public" }, { id: "private" }],
            members: [{ id: "private", user_id: "user", join_timestamp: "2026-01-01T00:00:00.000Z", flags: 0 }],
        });
    });

    test("serializes thread member date objects as ISO strings", () => {
        assert.deepEqual(serializeActiveGuildThreads([], [{ id: "thread", join_timestamp: new Date("2026-01-01T00:00:00.000Z"), flags: 0 }], "user"), {
            threads: [],
            members: [],
        });

        assert.deepEqual(
            serializeActiveGuildThreads(
                [{ id: "thread", guild_id: "guild", parent_id: "parent", type: 11, thread_metadata: { archived: false }, toJSON: () => ({ id: "thread" }) }],
                [{ id: "thread", join_timestamp: new Date("2026-01-01T00:00:00.000Z"), flags: 0 }],
                "user",
            ),
            {
                threads: [{ id: "thread" }],
                members: [{ id: "thread", user_id: "user", join_timestamp: "2026-01-01T00:00:00.000Z", flags: 0 }],
            },
        );
    });
});
