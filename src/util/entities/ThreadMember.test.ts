import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createRequire } from "node:module";

const localRequire = createRequire(__filename);

type ChannelEntity = import("./Channel").Channel;
type MemberEntity = import("./Member").Member;
type ThreadMemberClass = typeof import("./ThreadMember").ThreadMember;
type ThreadMembersUpdateEvent = import("../interfaces").ThreadMembersUpdateEvent;
type TransactionManager = {
    findOneOrFail: (entity: unknown, options: unknown) => Promise<unknown>;
    delete: (entity: unknown, criteria: unknown) => Promise<{ affected?: number | null }>;
    decrement: (entity: unknown, criteria: unknown, propertyPath: string, value: number) => Promise<unknown>;
};

const fallbackSchemaValue = new Proxy(Object.create(null), {
    get: (_target, property) => {
        if (property === Symbol.toPrimitive) return () => 0;
        if (property === "then") return undefined;
        if (property === "toString") return () => "0";
        if (property === "valueOf") return () => 0;
        return fallbackSchemaValue;
    },
});

const schemasPath = localRequire.resolve("@spacebar/schemas");
(localRequire.cache as Record<string, { exports: unknown } | undefined>)[schemasPath] = {
    exports: new Proxy(
        {
            ChannelType: {
                DM: 1,
                GROUP_DM: 3,
                GUILD_NEWS_THREAD: 10,
                GUILD_PUBLIC_THREAD: 11,
                GUILD_PRIVATE_THREAD: 12,
                GUILD_FORUM: 15,
                GUILD_MEDIA: 16,
            },
            PublicMemberProjection: {},
            PublicUserProjection: {},
            PublicVoiceStateProjection: {},
            RelationshipType: { FRIEND: 1 },
            ReadStateFlags: {
                IS_GUILD_CHANNEL: 1,
                IS_THREAD: 2,
                IS_MENTION_LOW_IMPORTANCE: 4,
            },
            ReadStateType: { CHANNEL: 0 },
        },
        {
            get: (target, property) => {
                if (property in target) return target[property as keyof typeof target];
                return fallbackSchemaValue;
            },
        },
    ),
};

const emittedEvents: ThreadMembersUpdateEvent[] = [];
let transactionManager: TransactionManager | undefined;
let transactionCount = 0;

const permissionMock = {
    has: () => false,
    hasThrow: () => undefined,
};

const utilMock = {
    Config: {
        get: () => ({
            guild: {
                publicThreadsInvitable: false,
            },
        }),
    },
    DiscordApiErrors: {
        CANNOT_MESSAGE_USER: new Error("CANNOT_MESSAGE_USER"),
        THREAD_ALREADY_CREATED_FOR_THIS_MESSAGE: new Error("THREAD_ALREADY_CREATED_FOR_THIS_MESSAGE"),
    },
    Permissions: {
        ALL: permissionMock,
        DEFAULT_DM_PERMISSIONS: permissionMock,
        FLAGS: {},
        NONE: permissionMock,
        finalPermission: () => permissionMock,
    },
    Snowflake: {
        generate: () => "snowflake",
    },
    assertChannelNamePresent: () => undefined,
    canCreateServerDm: () => true,
    emitEvent: async (event: ThreadMembersUpdateEvent) => {
        emittedEvents.push(event);
    },
    getDatabase: () => ({
        transaction: async <T>(callback: (manager: TransactionManager) => Promise<T>) => {
            assert.ok(transactionManager);
            transactionCount++;
            return callback(transactionManager);
        },
    }),
    getPermission: async () => permissionMock,
    handleFile: async () => undefined,
    normalizeChannelName: (value?: string) => value,
    normalizeThreadName: (value?: string) => value,
    shouldCheckServerDmPrivacy: () => false,
    trimSpecial: (value?: string) => value,
};

for (const path of [localRequire.resolve("../util"), localRequire.resolve("../util/index")]) {
    (localRequire.cache as Record<string, { exports: unknown } | undefined>)[path] = {
        exports: utilMock,
    };
}

const { Channel } = localRequire("./Channel") as { Channel: typeof import("./Channel").Channel };
const { Member } = localRequire("./Member") as { Member: typeof import("./Member").Member };
const { ThreadMember } = localRequire("./ThreadMember") as { ThreadMember: ThreadMemberClass };

afterEach(() => {
    transactionManager = undefined;
    transactionCount = 0;
    emittedEvents.length = 0;
});

function stubRemoval({ deleteAffected = 1, memberCount = 2 }: { deleteAffected?: number; memberCount?: number | null | undefined } = {}) {
    const calls: unknown[][] = [];
    const channel = Object.assign(new Channel(), {
        id: "thread-id",
        guild_id: "guild-id",
        member_count: memberCount,
    }) as ChannelEntity;
    const member = { index: "member-index" } satisfies Partial<MemberEntity>;

    transactionManager = {
        findOneOrFail: async (entity: unknown, options: unknown) => {
            if (entity === Channel) {
                calls.push(["findOneOrFail", "Channel", options]);
                return channel;
            }
            if (entity === Member) {
                calls.push(["findOneOrFail", "Member", options]);
                return member;
            }

            throw new Error("Unexpected findOneOrFail entity");
        },
        delete: async (entity: unknown, criteria: unknown) => {
            assert.equal(entity, ThreadMember);
            calls.push(["delete", "ThreadMember", criteria]);
            return { affected: deleteAffected };
        },
        decrement: async (entity: unknown, criteria: unknown, propertyPath: string, value: number) => {
            assert.equal(entity, Channel);
            calls.push(["decrement", "Channel", criteria, propertyPath, value]);
            if (channel.member_count !== null && channel.member_count !== undefined && channel.member_count > 0) {
                channel.member_count -= value;
            }
        },
    };

    return { calls, channel };
}

describe("ThreadMember.removeFromThread", () => {
    test("resolves the guild member index before deleting and emitting the removed user id", async () => {
        const { calls } = stubRemoval({ memberCount: 2 });

        await ThreadMember.removeFromThread("user-id", "thread-id");

        assert.equal(transactionCount, 1);
        assert.deepEqual(calls.slice(0, 3), [
            [
                "findOneOrFail",
                "Channel",
                {
                    where: { id: "thread-id" },
                    select: { id: true, guild_id: true, member_count: true },
                },
            ],
            [
                "findOneOrFail",
                "Member",
                {
                    where: { id: "user-id", guild_id: "guild-id" },
                    select: { index: true },
                },
            ],
            ["delete", "ThreadMember", { id: "thread-id", member_idx: "member-index" }],
        ]);
        assert.equal(calls[3][0], "decrement");
        assert.equal(calls[3][3], "member_count");
        assert.equal(calls[3][4], 1);
        assertMoreThanZero((calls[3][2] as { member_count?: unknown }).member_count);
        assert.deepEqual(calls[4], [
            "findOneOrFail",
            "Channel",
            {
                where: { id: "thread-id" },
                select: { id: true, guild_id: true, member_count: true },
            },
        ]);
        assert.equal(emittedEvents.length, 1);
        assert.deepEqual(emittedEvents[0].data, {
            guild_id: "guild-id",
            id: "thread-id",
            member_count: 1,
            removed_member_ids: ["user-id"],
        });
        assert.equal(emittedEvents[0].channel_id, "thread-id");
    });

    test("does not decrement below zero when removing a thread member", async () => {
        const { calls } = stubRemoval({ memberCount: 0 });

        await ThreadMember.removeFromThread("user-id", "thread-id");

        assert.equal(
            calls.some(([method]) => method === "decrement"),
            false,
        );
        assert.deepEqual(
            emittedEvents.map((event) => event.data.member_count),
            [0],
        );
    });

    test("uses the delete result as the membership authority before decrementing or emitting", async () => {
        const { calls } = stubRemoval({ deleteAffected: 0, memberCount: 2 });

        await assert.rejects(
            () => ThreadMember.removeFromThread("user-id", "thread-id"),
            (error) => (error as { code?: number }).code === 403,
        );

        assert.deepEqual(calls.slice(0, 3), [
            [
                "findOneOrFail",
                "Channel",
                {
                    where: { id: "thread-id" },
                    select: { id: true, guild_id: true, member_count: true },
                },
            ],
            [
                "findOneOrFail",
                "Member",
                {
                    where: { id: "user-id", guild_id: "guild-id" },
                    select: { index: true },
                },
            ],
            ["delete", "ThreadMember", { id: "thread-id", member_idx: "member-index" }],
        ]);
        assert.equal(
            calls.some(([method]) => method === "decrement"),
            false,
        );
        assert.deepEqual(emittedEvents, []);
    });
});

function assertMoreThanZero(value: unknown) {
    const operator = value as { type?: string; value?: unknown };
    assert.equal(operator.type, "moreThan");
    assert.equal(operator.value, 0);
}
