import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import Module from "node:module";

type LoadFunction = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => unknown;
type Range = [number, number];

interface MockMemberListOperation {
    items: unknown[];
    groups: { count: number; id: string }[];
    members: { user: { id: string } }[];
    online_count: number;
    range: Range;
}

interface MockMemberListResult {
    ops: MockMemberListOperation[];
    groups: { count: number; id: string }[];
    online_count: number;
}

interface DispatchPayload {
    d: {
        guild_id: string;
        groups: { count: number; id: string }[];
        member_count: number;
        online_count: number;
        ops: { items: unknown[]; op: string; range: Range }[];
    };
    op: number;
    s: number;
    t: string;
}

interface MockSocket {
    close: () => void;
    events: Record<string, unknown>;
    listen_options: Record<string, unknown>;
    member_events: Record<string, unknown>;
    sequence: number;
    user_id: string;
}

const moduleLoader = Module as unknown as { _load: LoadFunction };
const originalLoad = moduleLoader._load;

const state: {
    buildCalls: { guildId: string; members: unknown[]; ranges: Range[] }[];
    channelOverwrites: { allow: string; deny: string; id: string }[] | undefined;
    getManyCalls: number;
    guildMembers: unknown[];
    memberCount: number;
    memberListResult: MockMemberListResult;
    permissionChecks: string[];
    sentPayloads: DispatchPayload[];
    subscriptions: string[];
} = {
    buildCalls: [],
    channelOverwrites: undefined,
    getManyCalls: 0,
    guildMembers: [],
    memberCount: 0,
    memberListResult: { groups: [], online_count: 0, ops: [] },
    permissionChecks: [],
    sentPayloads: [],
    subscriptions: [],
};

const queryBuilder = {
    addOrderBy() {
        return queryBuilder;
    },
    addSelect() {
        return queryBuilder;
    },
    async getMany() {
        state.getManyCalls++;
        return state.guildMembers;
    },
    leftJoinAndSelect() {
        return queryBuilder;
    },
    orderBy() {
        return queryBuilder;
    },
    where() {
        return queryBuilder;
    },
};

const mockUtil = {
    Channel: {
        async findOneOrFail() {
            return { permission_overwrites: state.channelOverwrites };
        },
    },
    Member: {
        async count() {
            return state.memberCount;
        },
    },
    Permissions: {
        FLAGS: {
            VIEW_CHANNEL: 1n,
        },
    },
    Presence: undefined,
    Session: {
        async find() {
            return [];
        },
    },
    User: {
        async getPublicUser(id: string) {
            return { id };
        },
    },
    getDatabase() {
        return {
            getRepository() {
                return {
                    createQueryBuilder() {
                        return queryBuilder;
                    },
                };
            },
        };
    },
    getMostRelevantSession() {
        return undefined;
    },
    async getPermission() {
        return {
            hasThrow(permission: string) {
                state.permissionChecks.push(permission);
            },
        };
    },
    async listenEvent(userId: string) {
        state.subscriptions.push(userId);
        return { userId };
    },
};

const mockGateway = {
    OPCODES: {
        Dispatch: 0,
    },
    async Send(_socket: MockSocket, payload: DispatchPayload) {
        state.sentPayloads.push(payload);
    },
    WebSocket: class {},
    buildLazyMemberListOperations(members: unknown[], guildId: string, ranges: Range[]) {
        state.buildCalls.push({ guildId, members, ranges });
        return state.memberListResult;
    },
    handlePresenceUpdate() {
        return undefined;
    },
};

moduleLoader._load = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => {
    if (request === "@spacebar/util") return mockUtil;
    if (request === "@spacebar/gateway") return mockGateway;
    if (request === "@spacebar/schemas") return { LazyRequestSchema: {} };
    if (request === "./instanceOf" && parent?.filename?.endsWith("/LazyRequest.js")) return { check: () => true };

    return originalLoad(request, parent, isMain);
};

const { onLazyRequest } = require("./LazyRequest") as {
    onLazyRequest(this: MockSocket, payload: { d: unknown }): Promise<void>;
};

after(() => {
    moduleLoader._load = originalLoad;
});

beforeEach(() => {
    state.buildCalls = [];
    state.channelOverwrites = undefined;
    state.getManyCalls = 0;
    state.guildMembers = [{ id: "online-user" }, { id: "offline-user" }];
    state.memberCount = 3;
    state.memberListResult = { groups: [], online_count: 0, ops: [] };
    state.permissionChecks = [];
    state.sentPayloads = [];
    state.subscriptions = [];
});

function socket(): MockSocket {
    return {
        close() {
            throw new Error("validation should be mocked in LazyRequest tests");
        },
        events: {},
        listen_options: {},
        member_events: {},
        sequence: 0,
        user_id: "viewer",
    };
}

function memberListOp(range: Range, members: { user: { id: string } }[] = []): MockMemberListOperation {
    return {
        groups: [{ count: 1, id: "online" }],
        items: [{ group: { count: 1, id: "online" } }],
        members,
        online_count: 1,
        range,
    };
}

function sentUpdate() {
    assert.equal(state.sentPayloads.length, 1);
    return state.sentPayloads[0];
}

describe("lazy request member list loading", () => {
    test("loads guild members once and emits one sync op per requested range", async () => {
        const ranges: Range[] = [
            [0, 0],
            [1, 2],
        ];
        state.memberListResult = {
            groups: [{ count: 1, id: "online" }],
            online_count: 1,
            ops: [memberListOp(ranges[0], [{ user: { id: "online-user" } }]), memberListOp(ranges[1])],
        };

        await onLazyRequest.call(socket(), { d: { channels: { channel: ranges }, guild_id: "guild" } });

        assert.equal(state.getManyCalls, 1);
        assert.deepEqual(state.buildCalls, [{ guildId: "guild", members: state.guildMembers, ranges }]);
        assert.deepEqual(state.permissionChecks, ["VIEW_CHANNEL"]);

        const payload = sentUpdate();
        assert.equal(payload.t, "GUILD_MEMBER_LIST_UPDATE");
        assert.deepEqual(
            payload.d.ops.map((op) => ({ op: op.op, range: op.range })),
            [
                { op: "SYNC", range: ranges[0] },
                { op: "SYNC", range: ranges[1] },
            ],
        );
        assert.equal(payload.d.online_count, 1);
        assert.equal(payload.d.member_count, 3);
        assert.deepEqual(payload.d.groups, [{ count: 1, id: "online" }]);
        assert.deepEqual(state.subscriptions, ["online-user"]);
    });

    test("keeps computed online count and groups when no ranges are requested", async () => {
        state.memberListResult = {
            groups: [
                { count: 1, id: "online" },
                { count: 2, id: "offline" },
            ],
            online_count: 1,
            ops: [],
        };

        await onLazyRequest.call(socket(), { d: { channels: { channel: [] }, guild_id: "guild" } });

        assert.equal(state.getManyCalls, 1);
        assert.deepEqual(state.buildCalls, [{ guildId: "guild", members: state.guildMembers, ranges: [] }]);

        const payload = sentUpdate();
        assert.deepEqual(payload.d.ops, []);
        assert.equal(payload.d.online_count, 1);
        assert.equal(payload.d.member_count, 3);
        assert.deepEqual(payload.d.groups, [
            { count: 1, id: "online" },
            { count: 2, id: "offline" },
        ]);
    });
});
