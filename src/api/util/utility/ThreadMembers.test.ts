import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { HTTPError } from "lambert-server";
import {
    applyThreadMemberListQuery,
    assertThreadIsNotArchived,
    DEFAULT_THREAD_MEMBER_LIMIT,
    MAX_THREAD_MEMBER_COUNT,
    MAX_THREAD_MEMBER_LIMIT,
    parseThreadMemberLimit,
    parseThreadMemberWithMember,
    refreshThreadMemberCount,
    resolveThreadMemberUserId,
} from "./ThreadMembers";
import { Channel, ThreadMember } from "@spacebar/util";

const originalChannelUpdate = Channel.update;
const originalThreadMemberCountBy = ThreadMember.countBy;

describe("thread member helpers", () => {
    test("defaults thread member limit", () => {
        assert.equal(parseThreadMemberLimit(undefined), DEFAULT_THREAD_MEMBER_LIMIT);
    });

    test("accepts thread member limits in range", () => {
        assert.equal(parseThreadMemberLimit("1"), 1);
        assert.equal(parseThreadMemberLimit(String(MAX_THREAD_MEMBER_LIMIT)), MAX_THREAD_MEMBER_LIMIT);
    });

    test("rejects invalid thread member limits", () => {
        assertInvalidThreadMemberLimit("0");
        assertInvalidThreadMemberLimit(String(MAX_THREAD_MEMBER_LIMIT + 1));
        assertInvalidThreadMemberLimit("1.5");
        assertInvalidThreadMemberLimit("not-a-number");
    });

    test("parses with_member as an explicit true flag", () => {
        assert.equal(parseThreadMemberWithMember("true"), true);
        assert.equal(parseThreadMemberWithMember("false"), false);
        assert.equal(parseThreadMemberWithMember(undefined), false);
    });

    test("resolves @me user id", () => {
        assert.equal(resolveThreadMemberUserId("@me", "current-user"), "current-user");
        assert.equal(resolveThreadMemberUserId("other-user", "current-user"), "other-user");
    });

    test("rejects archived thread member mutation", () => {
        assert.doesNotThrow(() => assertThreadIsNotArchived({}));
        assert.doesNotThrow(() => assertThreadIsNotArchived({ thread_metadata: { archived: false } }));
        assert.throws(() => assertThreadIsNotArchived({ thread_metadata: { archived: true } }), RangeError);
    });

    test("refreshes and persists a stale thread member count from persisted thread members", async (t) => {
        const { countByCalls, updateCalls } = stubThreadMemberCountRefresh(t, 7);
        const thread = createThreadMemberCountSource({ member_count: 2 });

        assert.equal(await refreshThreadMemberCount(thread), 7);
        assert.equal(thread.member_count, 7);
        assert.deepEqual(countByCalls, [{ id: "thread-id" }]);
        assert.deepEqual(updateCalls, [[{ id: "thread-id" }, { member_count: 7 }]]);
    });

    test("caps refreshed thread member counts to Discord's approximate count maximum", async (t) => {
        const { countByCalls, updateCalls } = stubThreadMemberCountRefresh(t, MAX_THREAD_MEMBER_COUNT + 10);
        const thread = createThreadMemberCountSource({ member_count: 2 });

        assert.equal(await refreshThreadMemberCount(thread), MAX_THREAD_MEMBER_COUNT);
        assert.equal(thread.member_count, MAX_THREAD_MEMBER_COUNT);
        assert.deepEqual(countByCalls, [{ id: "thread-id" }]);
        assert.deepEqual(updateCalls, [[{ id: "thread-id" }, { member_count: MAX_THREAD_MEMBER_COUNT }]]);
    });

    test("backfills an undefined thread member count from persisted thread members", async (t) => {
        const { countByCalls, updateCalls } = stubThreadMemberCountRefresh(t, 4);
        const thread = createThreadMemberCountSource({ member_count: undefined });

        assert.equal(await refreshThreadMemberCount(thread), 4);
        assert.equal(thread.member_count, 4);
        assert.deepEqual(countByCalls, [{ id: "thread-id" }]);
        assert.deepEqual(updateCalls, [[{ id: "thread-id" }, { member_count: 4 }]]);
    });

    test("backfills a null thread member count from persisted thread members", async (t) => {
        const { countByCalls, updateCalls } = stubThreadMemberCountRefresh(t, 3);
        const thread = createThreadMemberCountSource({ member_count: null });

        assert.equal(await refreshThreadMemberCount(thread), 3);
        assert.equal(thread.member_count, 3);
        assert.deepEqual(countByCalls, [{ id: "thread-id" }]);
        assert.deepEqual(updateCalls, [[{ id: "thread-id" }, { member_count: 3 }]]);
    });

    test("builds thread member list query against member user ids", () => {
        const builder = createFakeQueryBuilder();

        assert.equal(
            applyThreadMemberListQuery(builder, {
                afterUserId: "after-user",
                limit: 26,
                threadId: "thread-id",
                withMember: true,
            }),
            builder,
        );

        assert.deepEqual(builder.calls, [
            ["where", "thread_member.id = :threadId", { threadId: "thread-id" }],
            ["leftJoinAndSelect", "thread_member.member", "member"],
            ["andWhere", "member.id > :afterUserId", { afterUserId: "after-user" }],
            ["orderBy", "member.id", "ASC"],
            ["take", 26],
        ]);
    });

    test("omits member selection and after predicate when not requested", () => {
        const builder = createFakeQueryBuilder();

        applyThreadMemberListQuery(builder, {
            limit: 100,
            threadId: "thread-id",
            withMember: false,
        });

        assert.equal(
            builder.calls.some(([method]) => method === "leftJoinAndSelect"),
            false,
        );
        assert.deepEqual(builder.calls.at(1), ["innerJoin", "thread_member.member", "member"]);
        assert.deepEqual(builder.calls.at(2), ["addSelect", "member.id"]);
        assert.equal(
            builder.calls.some(([method, condition]) => method === "andWhere" && typeof condition === "string" && condition.includes(":afterUserId")),
            false,
        );
        assert.deepEqual(builder.calls.at(-2), ["orderBy", "member.id", "ASC"]);
        assert.deepEqual(builder.calls.at(-1), ["take", 100]);
    });
});

function assertInvalidThreadMemberLimit(value: string) {
    let error: unknown;

    try {
        parseThreadMemberLimit(value);
    } catch (caught) {
        error = caught;
    }

    assert.ok(error instanceof HTTPError);
    assert.equal(error.code, 422);
    assert.equal(error.message, `limit must be between 1 and ${MAX_THREAD_MEMBER_LIMIT}`);
}

function stubThreadMemberCountRefresh(t: TestContext, count: number) {
    const countByCalls: unknown[] = [];
    const updateCalls: unknown[][] = [];
    Object.assign(ThreadMember, {
        countBy: async (where: unknown) => {
            countByCalls.push(where);
            return count;
        },
    });
    Object.assign(Channel, {
        update: async (...args: unknown[]) => {
            updateCalls.push(args);
            return { affected: 1, generatedMaps: [], raw: [] };
        },
    });
    t.after(() => {
        Object.assign(Channel, { update: originalChannelUpdate });
        Object.assign(ThreadMember, { countBy: originalThreadMemberCountBy });
    });
    return { countByCalls, updateCalls };
}

function createThreadMemberCountSource({ member_count }: { member_count?: number | null }) {
    return {
        id: "thread-id",
        member_count,
    };
}

type FakeQueryBuilderCall = [string, string, string] | [string, string, Record<string, unknown>?] | [string, number] | [string, string];

function createFakeQueryBuilder() {
    return {
        calls: [] as FakeQueryBuilderCall[],
        innerJoin(relation: string, alias: string) {
            this.calls.push(["innerJoin", relation, alias]);
            return this;
        },
        leftJoinAndSelect(relation: string, alias: string) {
            this.calls.push(["leftJoinAndSelect", relation, alias]);
            return this;
        },
        addSelect(selection: string) {
            this.calls.push(["addSelect", selection]);
            return this;
        },
        where(condition: string, parameters?: Record<string, unknown>) {
            this.calls.push(["where", condition, parameters]);
            return this;
        },
        andWhere(condition: string, parameters?: Record<string, unknown>) {
            this.calls.push(["andWhere", condition, parameters]);
            return this;
        },
        orderBy(sort: string, order?: "ASC" | "DESC") {
            this.calls.push(["orderBy", sort, order ?? "ASC"]);
            return this;
        },
        take(take?: number) {
            this.calls.push(["take", take ?? 0]);
            return this;
        },
    };
}
