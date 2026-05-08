import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createRequire } from "node:module";

const localRequire = createRequire(__filename);

type ChannelEntity = import("./Channel").Channel;
type MemberEntity = import("./Member").Member;
type ThreadMemberClass = typeof import("./ThreadMember").ThreadMember;
type ThreadMembersUpdateEvent = import("../interfaces").ThreadMembersUpdateEvent;

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

const utilMock = {
    emitEvent: async (event: ThreadMembersUpdateEvent) => {
        emittedEvents.push(event);
    },
};

for (const path of [localRequire.resolve("../util"), localRequire.resolve("../util/index")]) {
    (localRequire.cache as Record<string, { exports: unknown } | undefined>)[path] = {
        exports: utilMock,
    };
}

const { Channel } = localRequire("./Channel") as { Channel: typeof import("./Channel").Channel };
const { Member } = localRequire("./Member") as { Member: typeof import("./Member").Member };
const { ThreadMember } = localRequire("./ThreadMember") as { ThreadMember: ThreadMemberClass };

const originals = {
    channelFindOneOrFail: Channel.findOneOrFail,
    channelSave: Channel.prototype.save,
    memberFindOneOrFail: Member.findOneOrFail,
    threadMemberCount: ThreadMember.count,
    threadMemberDelete: ThreadMember.delete,
};

afterEach(() => {
    Object.assign(Channel, {
        findOneOrFail: originals.channelFindOneOrFail,
    });
    Object.assign(Channel.prototype, {
        save: originals.channelSave,
    });
    Object.assign(Member, {
        findOneOrFail: originals.memberFindOneOrFail,
    });
    Object.assign(ThreadMember, {
        count: originals.threadMemberCount,
        delete: originals.threadMemberDelete,
    });
    emittedEvents.length = 0;
});

function stubChannel(memberCount: number | null | undefined = 2) {
    const saves: number[] = [];
    const channel = Object.assign(new Channel(), {
        id: "thread-id",
        guild_id: "guild-id",
        member_count: memberCount,
    }) as ChannelEntity;

    Object.assign(Channel, {
        findOneOrFail: async (options: unknown) => {
            assert.deepEqual(options, { where: { id: "thread-id" } });
            return channel;
        },
    });
    Object.assign(Channel.prototype, {
        save: async function (this: ChannelEntity) {
            saves.push(this.member_count ?? -1);
            return this;
        },
    });

    return { channel, saves };
}

function stubMember() {
    const lookups: unknown[] = [];
    Object.assign(Member, {
        findOneOrFail: async (options: unknown) => {
            lookups.push(options);
            return { index: "member-index" } satisfies Partial<MemberEntity>;
        },
    });
    return lookups;
}

describe("ThreadMember.removeFromThread", () => {
    test("resolves the guild member index before deleting and emitting the removed user id", async () => {
        const { saves } = stubChannel(2);
        const memberLookups = stubMember();
        const counts: unknown[] = [];
        const deletes: unknown[] = [];

        Object.assign(ThreadMember, {
            count: async (criteria: unknown) => {
                counts.push(criteria);
                return 1;
            },
            delete: async (criteria: unknown) => {
                deletes.push(criteria);
                return { affected: 1 };
            },
        });

        await ThreadMember.removeFromThread("user-id", "thread-id");

        assert.deepEqual(memberLookups, [
            {
                where: { id: "user-id", guild_id: "guild-id" },
                select: { index: true },
            },
        ]);
        assert.deepEqual(counts, [{ where: { id: "thread-id", member_idx: "member-index" } }]);
        assert.deepEqual(deletes, [{ id: "thread-id", member_idx: "member-index" }]);
        assert.deepEqual(saves, [1]);
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
        const { saves } = stubChannel(0);
        stubMember();

        Object.assign(ThreadMember, {
            count: async () => 1,
            delete: async () => ({ affected: 1 }),
        });

        await ThreadMember.removeFromThread("user-id", "thread-id");

        assert.deepEqual(saves, []);
        assert.deepEqual(
            emittedEvents.map((event) => event.data.member_count),
            [0],
        );
    });

    test("throws without persisting or emitting when the resolved member is not in the thread", async () => {
        const { saves } = stubChannel(2);
        stubMember();
        const deletes: unknown[] = [];

        Object.assign(ThreadMember, {
            count: async (criteria: unknown) => {
                assert.deepEqual(criteria, { where: { id: "thread-id", member_idx: "member-index" } });
                return 0;
            },
            delete: async (criteria: unknown) => {
                deletes.push(criteria);
                return { affected: 0 };
            },
        });

        await assert.rejects(
            () => ThreadMember.removeFromThread("user-id", "thread-id"),
            (error) => (error as { code?: number }).code === 403,
        );

        assert.deepEqual(saves, []);
        assert.deepEqual(deletes, []);
        assert.deepEqual(emittedEvents, []);
    });
});
