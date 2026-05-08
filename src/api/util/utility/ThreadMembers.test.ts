import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { HTTPError } from "lambert-server";
import { FieldError, ThreadMemberFlags } from "@spacebar/util";
import {
    applyThreadMemberListQuery,
    applyThreadMemberSettingsUpdate,
    assertThreadIsNotArchived,
    DEFAULT_THREAD_MEMBER_LIMIT,
    MAX_THREAD_MEMBER_LIMIT,
    parseThreadMemberLimit,
    parseThreadMemberWithMember,
    resolveThreadMemberUserId,
    serializePublicThreadMember,
} from "./ThreadMembers";

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

    test("applies thread member settings while preserving server-managed interaction flag", () => {
        const threadMember = createThreadMember({
            flags: ThreadMemberFlags.HAS_INTERACTED | ThreadMemberFlags.ALL_MESSAGES,
            muted: false,
        });

        const result = applyThreadMemberSettingsUpdate(threadMember, {
            flags: ThreadMemberFlags.ONLY_MENTIONS,
            muted: true,
            mute_config: {
                end_time: "2026-02-03T04:05:06.000Z",
                selected_time_window: 3600,
            },
        });

        assert.equal(result.changed, true);
        assert.equal(threadMember.flags, ThreadMemberFlags.HAS_INTERACTED | ThreadMemberFlags.ONLY_MENTIONS);
        assert.equal(threadMember.muted, true);
        assert.deepEqual(threadMember.mute_config, {
            end_time: new Date("2026-02-03T04:05:06.000Z"),
            selected_time_window: 3600,
        });
    });

    test("detects unchanged thread member settings", () => {
        const threadMember = createThreadMember({
            flags: ThreadMemberFlags.NO_MESSAGES,
            muted: true,
            mute_config: {
                end_time: new Date("2026-02-03T04:05:06.000Z"),
                selected_time_window: 3600,
            },
        });

        const result = applyThreadMemberSettingsUpdate(threadMember, {
            flags: ThreadMemberFlags.NO_MESSAGES,
            muted: true,
            mute_config: {
                end_time: "2026-02-03T04:05:06.000Z",
                selected_time_window: 3600,
            },
        });

        assert.equal(result.changed, false);
    });

    test("clears thread member mute config with null", () => {
        const threadMember = createThreadMember({
            muted: true,
            mute_config: { selected_time_window: 3600 },
        });

        const result = applyThreadMemberSettingsUpdate(threadMember, { mute_config: null });

        assert.equal(result.changed, true);
        assert.equal(threadMember.mute_config, undefined);
    });

    test("rejects client-managed thread member flags", () => {
        assertInvalidThreadMemberSettingsFlags(ThreadMemberFlags.HAS_INTERACTED);
        assertInvalidThreadMemberSettingsFlags(1 << 9);
    });

    test("serializes public thread member update payload", () => {
        const serialized = serializePublicThreadMember(
            createThreadMember({
                id: "thread-id",
                join_timestamp: new Date("2026-01-02T03:04:05.000Z"),
                flags: ThreadMemberFlags.ONLY_MENTIONS,
                muted: true,
                mute_config: { end_time: new Date("2026-02-03T04:05:06.000Z") },
            }),
            "user-id",
        );

        assert.deepEqual(serialized, {
            id: "thread-id",
            user_id: "user-id",
            join_timestamp: "2026-01-02T03:04:05.000Z",
            flags: ThreadMemberFlags.ONLY_MENTIONS,
            muted: true,
            mute_config: { end_time: "2026-02-03T04:05:06.000Z" },
        });
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
            ["where", '"thread_member"."id" = :threadId', { threadId: "thread-id" }],
            ["leftJoinAndSelect", "thread_member.member", "member"],
            ["andWhere", '"member"."id" > :afterUserId', { afterUserId: "after-user" }],
            ["orderBy", '"member"."id"', "ASC"],
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
        assert.equal(
            builder.calls.some(([method, condition]) => method === "andWhere" && typeof condition === "string" && condition.includes(":afterUserId")),
            false,
        );
        assert.deepEqual(builder.calls.at(-2), ["orderBy", '"member"."id"', "ASC"]);
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

type FakeQueryBuilderCall = [string, string, string] | [string, string, Record<string, unknown>?] | [string, number];

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

function assertInvalidThreadMemberSettingsFlags(flags: number) {
    let error: unknown;

    try {
        applyThreadMemberSettingsUpdate(createThreadMember(), { flags });
    } catch (caught) {
        error = caught;
    }

    assert.ok(error instanceof FieldError);
    assert.equal(error.code, 50035);
}

function createThreadMember(overrides: Record<string, unknown> = {}) {
    return {
        id: "thread-id",
        join_timestamp: new Date("2026-01-02T03:04:05.000Z"),
        flags: ThreadMemberFlags.ALL_MESSAGES,
        muted: false,
        mute_config: undefined,
        ...overrides,
    } as Parameters<typeof applyThreadMemberSettingsUpdate>[0];
}
