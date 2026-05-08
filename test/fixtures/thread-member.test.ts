import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { Channel, Member, ThreadMember, ThreadMembersUpdateEvent } from "@spacebar/util";
import { makeChannel, makeMember } from "./entities";
import { captureEvents } from "./events";

type FindOneChannelOptions = {
    where?: {
        id?: string;
    };
};

type DeleteOptions = {
    id?: string;
    member_idx?: string;
};

type CountOptions = {
    where?: DeleteOptions;
};

type FindOneMemberOptions = {
    where?: {
        id?: string;
        guild_id?: string;
    };
    select?: {
        index?: boolean;
    };
};

const GUILD_PUBLIC_THREAD = 11;
const GUILD_TEXT = 0;

const originals = {
    channelFindOneOrFail: Channel.findOneOrFail,
    memberFindOneOrFail: Member.findOneOrFail,
    threadMemberCount: ThreadMember.count,
    threadMemberDelete: ThreadMember.delete,
};

afterEach(() => {
    Object.assign(Channel, {
        findOneOrFail: originals.channelFindOneOrFail,
    });
    Object.assign(Member, {
        findOneOrFail: originals.memberFindOneOrFail,
    });
    Object.assign(ThreadMember, {
        count: originals.threadMemberCount,
        delete: originals.threadMemberDelete,
    });
});

describe("ThreadMember.removeFromThread", () => {
    test("resolves the user's guild member, removes by member index, persists the count, and emits with the user id", async () => {
        const capture = await captureEvents("thread-id");
        try {
            const deleteCalls: DeleteOptions[] = [];
            let saveCalls = 0;
            const thread = makeChannel(undefined, { id: "thread-id", guild_id: "guild-id", type: GUILD_PUBLIC_THREAD, member_count: 2 });
            Object.assign(thread, {
                save: async () => {
                    saveCalls++;
                    return thread;
                },
            });
            Object.assign(Channel, {
                findOneOrFail: async (options: FindOneChannelOptions) => {
                    assert.equal(options.where?.id, "thread-id");
                    return thread;
                },
            });
            Object.assign(Member, {
                findOneOrFail: async (options: FindOneMemberOptions) => {
                    assert.deepEqual(options.where, { id: "user-id", guild_id: "guild-id" });
                    assert.deepEqual(options.select, { index: true });
                    return makeMember(undefined, thread.guild, { index: "member-index" });
                },
            });
            Object.assign(ThreadMember, {
                count: async (options: CountOptions) => {
                    assert.deepEqual(options.where, { id: "thread-id", member_idx: "member-index" });
                    return 1;
                },
                delete: async (options: DeleteOptions) => {
                    deleteCalls.push(options);
                    return { affected: 1, raw: [] };
                },
            });

            await ThreadMember.removeFromThread("user-id", "thread-id");

            assert.equal(saveCalls, 1);
            assert.equal(thread.member_count, 1);
            assert.deepEqual(deleteCalls, [{ id: "thread-id", member_idx: "member-index" }]);
            assert.deepEqual(capture.expectOne("THREAD_MEMBERS_UPDATE") as ThreadMembersUpdateEvent, {
                event: "THREAD_MEMBERS_UPDATE",
                data: {
                    guild_id: "guild-id",
                    id: "thread-id",
                    member_count: 1,
                    removed_member_ids: ["user-id"],
                },
                channel_id: "thread-id",
            });
        } finally {
            await capture.stop();
        }
    });

    test("rejects non-thread channels before deleting or emitting", async () => {
        const capture = await captureEvents("channel-id");
        try {
            let memberLookupCalled = false;
            let countCalled = false;
            let deleteCalled = false;
            Object.assign(Channel, {
                findOneOrFail: async () => makeChannel(undefined, { id: "channel-id", guild_id: "guild-id", type: GUILD_TEXT, member_count: 1 }),
            });
            Object.assign(Member, {
                findOneOrFail: async () => {
                    memberLookupCalled = true;
                    return makeMember(undefined, undefined, { index: "member-index" });
                },
            });
            Object.assign(ThreadMember, {
                count: async () => {
                    countCalled = true;
                    return 1;
                },
                delete: async () => {
                    deleteCalled = true;
                    return { affected: 1, raw: [] };
                },
            });

            await assert.rejects(() => ThreadMember.removeFromThread("user-id", "channel-id"), /Channel is not a thread/);

            assert.equal(memberLookupCalled, false);
            assert.equal(countCalled, false);
            assert.equal(deleteCalled, false);
            assert.deepEqual(capture.events, []);
        } finally {
            await capture.stop();
        }
    });

    test("rejects threads without guild ids before deleting or emitting", async () => {
        const capture = await captureEvents("thread-id");
        try {
            let memberLookupCalled = false;
            let countCalled = false;
            let deleteCalled = false;
            Object.assign(Channel, {
                findOneOrFail: async () => makeChannel(undefined, { id: "thread-id", guild_id: undefined, type: GUILD_PUBLIC_THREAD, member_count: 1 }),
            });
            Object.assign(Member, {
                findOneOrFail: async () => {
                    memberLookupCalled = true;
                    return makeMember(undefined, undefined, { index: "member-index" });
                },
            });
            Object.assign(ThreadMember, {
                count: async () => {
                    countCalled = true;
                    return 1;
                },
                delete: async () => {
                    deleteCalled = true;
                    return { affected: 1, raw: [] };
                },
            });

            await assert.rejects(() => ThreadMember.removeFromThread("user-id", "thread-id"), /Thread guild id not set/);

            assert.equal(memberLookupCalled, false);
            assert.equal(countCalled, false);
            assert.equal(deleteCalled, false);
            assert.deepEqual(capture.events, []);
        } finally {
            await capture.stop();
        }
    });

    test("rejects users that are not thread members before persisting, deleting, or emitting", async () => {
        const capture = await captureEvents("thread-id");
        try {
            let saveCalled = false;
            let deleteCalled = false;
            const thread = makeChannel(undefined, { id: "thread-id", guild_id: "guild-id", type: GUILD_PUBLIC_THREAD, member_count: 2 });
            Object.assign(thread, {
                save: async () => {
                    saveCalled = true;
                    return thread;
                },
            });
            Object.assign(Channel, {
                findOneOrFail: async () => thread,
            });
            Object.assign(Member, {
                findOneOrFail: async () => makeMember(undefined, thread.guild, { index: "member-index" }),
            });
            Object.assign(ThreadMember, {
                count: async (options: CountOptions) => {
                    assert.deepEqual(options.where, { id: "thread-id", member_idx: "member-index" });
                    return 0;
                },
                delete: async () => {
                    deleteCalled = true;
                    return { affected: 0, raw: [] };
                },
            });

            await assert.rejects(() => ThreadMember.removeFromThread("user-id", "thread-id"), /You are not member of this thread/);

            assert.equal(saveCalled, false);
            assert.equal(deleteCalled, false);
            assert.deepEqual(capture.events, []);
        } finally {
            await capture.stop();
        }
    });
});
