import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { createRequire } from "node:module";

type ChannelEntity = import("./Channel").Channel;
type ChannelClass = typeof import("./Channel").Channel;
type ThreadMemberClass = typeof import("./ThreadMember").ThreadMember;
type ThreadMembersUpdateEvent = import("../interfaces").ThreadMembersUpdateEvent;

type FindOneOptionsWithId = {
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

const localRequire = createRequire(__filename);
const GUILD_PUBLIC_THREAD = 11;
const GUILD_TEXT = 0;

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
const schemasMock = new Proxy(
    {
        ChannelType: {
            DM: 1,
            GROUP_DM: 3,
            GUILD_TEXT,
            GUILD_NEWS_THREAD: 10,
            GUILD_PUBLIC_THREAD,
            GUILD_PRIVATE_THREAD: 12,
            GUILD_FORUM: 15,
            GUILD_MEDIA: 16,
        },
    },
    {
        get: (target, property) => {
            if (property in target) return target[property as keyof typeof target];
            return fallbackSchemaValue;
        },
    },
);

(localRequire.cache as Record<string, { exports: unknown } | undefined>)[schemasPath] = {
    exports: schemasMock,
};

const emittedEvents: ThreadMembersUpdateEvent[] = [];

const utilMock = {
    Config: { get: () => ({}) },
    DiscordApiErrors: {},
    FieldErrors: class FieldErrors extends Error {},
    InvisibleCharacters: [],
    Permissions: {
        ALL: {},
        DEFAULT_DM_PERMISSIONS: {},
        NONE: {},
        finalPermission: () => ({ has: () => false, hasThrow: () => undefined }),
    },
    Snowflake: { generate: () => "generated-id" },
    emitEvent: async (event: ThreadMembersUpdateEvent) => {
        emittedEvents.push(event);
    },
    getDatabase: () => null,
    getPermission: async () => ({ hasThrow: () => undefined }),
    handleFile: async () => undefined,
    trimSpecial: (value?: string) => value,
};

for (const path of [localRequire.resolve("../util"), localRequire.resolve("..")]) {
    (localRequire.cache as Record<string, { exports: unknown } | undefined>)[path] = {
        exports: utilMock,
    };
}

const { Channel } = localRequire("./Channel") as { Channel: ChannelClass };
const { ThreadMember } = localRequire("./ThreadMember") as { ThreadMember: ThreadMemberClass };

const originals = {
    channelFindOneOrFail: Channel.findOneOrFail,
    threadMemberCount: ThreadMember.count,
    threadMemberDelete: ThreadMember.delete,
};

afterEach(() => {
    emittedEvents.length = 0;
    Object.assign(Channel, {
        findOneOrFail: originals.channelFindOneOrFail,
    });
    Object.assign(ThreadMember, {
        count: originals.threadMemberCount,
        delete: originals.threadMemberDelete,
    });
});

function makeChannel(props: Partial<ChannelEntity>) {
    return Object.assign(new Channel(), props);
}

describe("ThreadMember.removeFromThread", () => {
    test("emits removed member update with the thread channel guild id", async () => {
        const deleteCalls: DeleteOptions[] = [];
        Object.assign(Channel, {
            findOneOrFail: async (options: FindOneOptionsWithId) => {
                assert.equal(options.where?.id, "thread-id");
                return makeChannel({ id: "thread-id", guild_id: "guild-id", type: GUILD_PUBLIC_THREAD, member_count: 2 });
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

        await ThreadMember.removeFromThread("member-index", "thread-id");

        assert.deepEqual(deleteCalls, [{ id: "thread-id", member_idx: "member-index" }]);
        assert.equal(emittedEvents.length, 1);
        assert.deepEqual(emittedEvents[0], {
            event: "THREAD_MEMBERS_UPDATE",
            data: {
                guild_id: "guild-id",
                id: "thread-id",
                member_count: 1,
                removed_member_ids: ["member-index"],
            },
            channel_id: "thread-id",
        });
    });

    test("rejects non-thread channels before deleting or emitting", async () => {
        let countCalled = false;
        let deleteCalled = false;
        Object.assign(Channel, {
            findOneOrFail: async () => makeChannel({ id: "channel-id", guild_id: "guild-id", type: GUILD_TEXT, member_count: 1 }),
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

        await assert.rejects(() => ThreadMember.removeFromThread("member-index", "channel-id"), /Channel is not a thread/);

        assert.equal(countCalled, false);
        assert.equal(deleteCalled, false);
        assert.deepEqual(emittedEvents, []);
    });

    test("rejects threads without guild ids before deleting or emitting", async () => {
        let countCalled = false;
        let deleteCalled = false;
        Object.assign(Channel, {
            findOneOrFail: async () => makeChannel({ id: "thread-id", type: GUILD_PUBLIC_THREAD, member_count: 1 }),
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

        await assert.rejects(() => ThreadMember.removeFromThread("member-index", "thread-id"), /Thread guild id not set/);

        assert.equal(countCalled, false);
        assert.equal(deleteCalled, false);
        assert.deepEqual(emittedEvents, []);
    });
});
