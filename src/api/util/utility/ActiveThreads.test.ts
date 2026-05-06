import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canAccessActiveGuildThread, filterAccessibleActiveGuildThreads, isActiveGuildThread, serializeActiveGuildThreads } from "./ActiveThreads";

describe("active guild thread utilities", () => {
    const viewParent = new Map([["parent", { has: (permission: string) => permission === "VIEW_CHANNEL" }]]);
    const manageParent = new Map([["parent", { has: (permission: string) => permission === "VIEW_CHANNEL" || permission === "MANAGE_THREADS" }]]);

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
                { id: "private", toJSON: () => ({ id: "private", member_idx: "member" }) },
                { id: "hidden", toJSON: () => ({ id: "hidden", member_idx: "member" }) },
            ],
        );

        assert.deepEqual(response, {
            threads: [{ id: "public" }, { id: "private" }],
            members: [{ id: "private", member_idx: "member" }],
        });
    });
});
