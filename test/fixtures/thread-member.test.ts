import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { Channel, Member, ThreadMember, ThreadMembersUpdateEvent } from "@spacebar/util";
import { makeChannel, makeMember } from "./entities";
import { captureEvents } from "./events";

type FindOneOptions = {
    where?: {
        id?: string;
        guild_id?: string;
    };
    select?: Record<string, boolean>;
};

type DeleteOptions = {
    id?: string;
    member_idx?: string;
};

type TransactionManager = {
    findOneOrFail: (entity: unknown, options: FindOneOptions) => Promise<unknown>;
    delete: (entity: unknown, criteria: DeleteOptions) => Promise<{ affected?: number | null }>;
    count: (entity: unknown, options: unknown) => Promise<number>;
    update: (entity: unknown, criteria: unknown, values: unknown) => Promise<unknown>;
};

const GUILD_PUBLIC_THREAD = 11;
const GUILD_TEXT = 0;

function mockDatabase(t: TestContext, manager: TransactionManager) {
    const databaseModule = require(`${process.cwd()}/dist/util/util/Database`) as typeof import("../../src/util/util/Database");
    t.mock.method(databaseModule, "getDatabase", () => ({
        transaction: async <T>(callback: (transactionManager: TransactionManager) => Promise<T>) => callback(manager),
    }));
}

describe("ThreadMember.removeFromThread", () => {
    test("resolves the user's guild member, removes by member index, persists the count, and emits with the user id", async (t) => {
        const capture = await captureEvents("thread-id");
        try {
            const deleteCalls: DeleteOptions[] = [];
            const thread = makeChannel(undefined, { id: "thread-id", guild_id: "guild-id", type: GUILD_PUBLIC_THREAD, member_count: 2 });
            let countCalls = 0;
            let updateCalls = 0;
            mockDatabase(t, {
                async findOneOrFail(entity, options) {
                    if (entity === Channel) {
                        assert.equal(options.where?.id, "thread-id");
                        return thread;
                    }
                    if (entity === Member) {
                        assert.deepEqual(options.where, { id: "user-id", guild_id: "guild-id" });
                        assert.deepEqual(options.select, { index: true });
                        return makeMember(undefined, thread.guild, { index: "member-index" });
                    }
                    throw new Error("Unexpected entity lookup");
                },
                async delete(entity, options) {
                    assert.equal(entity, ThreadMember);
                    deleteCalls.push(options);
                    return { affected: 1, raw: [] };
                },
                async count(entity, options) {
                    assert.equal(entity, ThreadMember);
                    assert.deepEqual(options, { where: { id: "thread-id" } });
                    countCalls++;
                    return 1;
                },
                async update(entity, criteria, values) {
                    assert.equal(entity, Channel);
                    assert.deepEqual(criteria, { id: "thread-id" });
                    assert.deepEqual(values, { member_count: 1 });
                    updateCalls++;
                    thread.member_count = 1;
                },
            });

            await ThreadMember.removeFromThread("user-id", "thread-id");

            assert.equal(countCalls, 1);
            assert.equal(updateCalls, 1);
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

    test("rejects non-thread channels before deleting or emitting", async (t) => {
        const capture = await captureEvents("channel-id");
        try {
            let memberLookupCalled = false;
            let deleteCalled = false;
            mockDatabase(t, {
                async findOneOrFail(entity) {
                    if (entity === Member) memberLookupCalled = true;
                    if (entity === Channel) return makeChannel(undefined, { id: "channel-id", guild_id: "guild-id", type: GUILD_TEXT, member_count: 1 });
                    throw new Error("Unexpected entity lookup");
                },
                async delete() {
                    deleteCalled = true;
                    return { affected: 1, raw: [] };
                },
                async count() {
                    throw new Error("count should not be called");
                },
                async update() {
                    throw new Error("update should not be called");
                },
            });

            await assert.rejects(() => ThreadMember.removeFromThread("user-id", "channel-id"), /Channel is not a thread/);

            assert.equal(memberLookupCalled, false);
            assert.equal(deleteCalled, false);
            assert.deepEqual(capture.events, []);
        } finally {
            await capture.stop();
        }
    });

    test("rejects threads without guild ids before deleting or emitting", async (t) => {
        const capture = await captureEvents("thread-id");
        try {
            let memberLookupCalled = false;
            let deleteCalled = false;
            mockDatabase(t, {
                async findOneOrFail(entity) {
                    if (entity === Member) memberLookupCalled = true;
                    if (entity === Channel) return makeChannel(undefined, { id: "thread-id", guild_id: undefined, type: GUILD_PUBLIC_THREAD, member_count: 1 });
                    throw new Error("Unexpected entity lookup");
                },
                async delete() {
                    deleteCalled = true;
                    return { affected: 1, raw: [] };
                },
                async count() {
                    throw new Error("count should not be called");
                },
                async update() {
                    throw new Error("update should not be called");
                },
            });

            await assert.rejects(() => ThreadMember.removeFromThread("user-id", "thread-id"), /Thread guild id not set/);

            assert.equal(memberLookupCalled, false);
            assert.equal(deleteCalled, false);
            assert.deepEqual(capture.events, []);
        } finally {
            await capture.stop();
        }
    });

    test("rejects users that are not thread members before persisting, deleting, or emitting", async (t) => {
        const capture = await captureEvents("thread-id");
        try {
            let countCalled = false;
            let updateCalled = false;
            let deleteCalled = false;
            const thread = makeChannel(undefined, { id: "thread-id", guild_id: "guild-id", type: GUILD_PUBLIC_THREAD, member_count: 2 });
            mockDatabase(t, {
                async findOneOrFail(entity) {
                    if (entity === Channel) return thread;
                    if (entity === Member) return makeMember(undefined, thread.guild, { index: "member-index" });
                    throw new Error("Unexpected entity lookup");
                },
                async delete(entity, options) {
                    assert.equal(entity, ThreadMember);
                    assert.deepEqual(options, { id: "thread-id", member_idx: "member-index" });
                    deleteCalled = true;
                    return { affected: 0, raw: [] };
                },
                async count() {
                    countCalled = true;
                    return 1;
                },
                async update() {
                    updateCalled = true;
                },
            });

            await assert.rejects(() => ThreadMember.removeFromThread("user-id", "thread-id"), /You are not member of this thread/);

            assert.equal(deleteCalled, true);
            assert.equal(countCalled, false);
            assert.equal(updateCalled, false);
            assert.deepEqual(capture.events, []);
        } finally {
            await capture.stop();
        }
    });
});
