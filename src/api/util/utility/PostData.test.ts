import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ChannelType } from "@spacebar/schemas/api/channels/Channel";
import { ACTIVE_GUILD_THREAD_TYPES } from "./ActiveThreads";
import { createPostDataOwnerMemberWhere, createPostDataThreadWhere, filterPostDataThreadsForViewer, findPostDataOwner, uniquePostDataThreadIds } from "./PostData";

describe("post-data route helpers", () => {
    test("deduplicates requested thread ids before querying", () => {
        assert.deepEqual(uniquePostDataThreadIds(["thread-a", "thread-b", "thread-a"]), ["thread-a", "thread-b"]);
    });

    test("builds a parent-scoped thread query", () => {
        const where = createPostDataThreadWhere("parent-id", ["thread-a", "thread-b", "thread-a"]);

        assert.equal(where?.parent_id, "parent-id");
        assert.equal(typeof where?.id, "object");
        assert.equal((where?.id as { _type?: string })._type, "in");
        assert.deepEqual((where?.id as { _value?: string[] })._value, ["thread-a", "thread-b"]);
        assert.equal(typeof where?.type, "object");
        assert.equal((where?.type as { _type?: string })._type, "in");
        assert.deepEqual((where?.type as { _value?: ChannelType[] })._value, [ChannelType.GUILD_NEWS_THREAD, ChannelType.GUILD_PUBLIC_THREAD, ChannelType.GUILD_PRIVATE_THREAD]);
        assert.deepEqual((where?.type as { _value?: readonly ChannelType[] })._value, ACTIVE_GUILD_THREAD_TYPES);
        assert.equal((where?.type as { _value?: ChannelType[] })._value?.includes(ChannelType.GUILD_TEXT), false);
    });

    test("omits the thread query when no thread ids are requested", () => {
        assert.equal(createPostDataThreadWhere("parent-id", []), undefined);
    });

    test("scopes owner member lookups to the thread guild", () => {
        const thread = {
            id: "thread-id",
            parent_id: "parent-id",
            guild_id: "guild-a",
            owner_id: "owner-id",
            type: ChannelType.GUILD_PUBLIC_THREAD,
        };
        const members = [
            { id: "owner-id", guild_id: "guild-b", marker: "wrong-guild" },
            { id: "owner-id", guild_id: "guild-a", marker: "right-guild" },
        ];

        assert.equal(findPostDataOwner(members, thread)?.marker, "right-guild");
    });

    test("builds unique owner member predicates per owner and guild", () => {
        assert.deepEqual(
            createPostDataOwnerMemberWhere([
                { id: "thread-a", parent_id: "parent-id", guild_id: "guild-a", owner_id: "owner-id", type: ChannelType.GUILD_PUBLIC_THREAD },
                { id: "thread-b", parent_id: "parent-id", guild_id: "guild-a", owner_id: "owner-id", type: ChannelType.GUILD_PUBLIC_THREAD },
                { id: "thread-c", parent_id: "parent-id", guild_id: "guild-b", owner_id: "owner-id", type: ChannelType.GUILD_PUBLIC_THREAD },
                { id: "thread-d", parent_id: "parent-id", guild_id: undefined, owner_id: "owner-id", type: ChannelType.GUILD_PUBLIC_THREAD },
                { id: "thread-e", parent_id: "parent-id", guild_id: "guild-a", owner_id: undefined, type: ChannelType.GUILD_PUBLIC_THREAD },
            ]),
            [
                { id: "owner-id", guild_id: "guild-a" },
                { id: "owner-id", guild_id: "guild-b" },
            ],
        );
    });

    test("filters private threads to joined or owned threads without manage threads", () => {
        const threads = [
            { id: "public-thread", parent_id: "parent-id", guild_id: "guild-id", owner_id: "other-id", type: ChannelType.GUILD_PUBLIC_THREAD },
            { id: "joined-private-thread", parent_id: "parent-id", guild_id: "guild-id", owner_id: "other-id", type: ChannelType.GUILD_PRIVATE_THREAD },
            { id: "owned-private-thread", parent_id: "parent-id", guild_id: "guild-id", owner_id: "viewer-id", type: ChannelType.GUILD_PRIVATE_THREAD },
            { id: "hidden-private-thread", parent_id: "parent-id", guild_id: "guild-id", owner_id: "other-id", type: ChannelType.GUILD_PRIVATE_THREAD },
        ];

        assert.deepEqual(
            filterPostDataThreadsForViewer(threads, [{ id: "joined-private-thread" }], "viewer-id", { has: () => false }).map(({ id }) => id),
            ["public-thread", "joined-private-thread", "owned-private-thread"],
        );
    });

    test("allows all parent-scoped threads for users with manage threads", () => {
        const threads = [{ id: "hidden-private-thread", parent_id: "parent-id", guild_id: "guild-id", owner_id: "other-id", type: ChannelType.GUILD_PRIVATE_THREAD }];

        assert.deepEqual(filterPostDataThreadsForViewer(threads, [], "viewer-id", { has: () => true }), threads);
    });
});
