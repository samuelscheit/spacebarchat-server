import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import Module from "node:module";

type LoadFunction = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => unknown;

interface MockSocket {
    sequence: number;
    user_id: string;
}

interface DispatchPayload {
    d: {
        id: string;
        members: unknown[];
        presences: unknown[];
    };
    op: number;
    s: number;
    t: string;
}

interface QueryCall {
    alias: string;
    andWheres: { parameters: unknown; sql: string }[];
    entity: unknown;
    joins: string[];
    orderBys: { direction: string; sort: string }[];
    selects: { alias?: string; selection: string }[];
    wheres: { parameters: unknown; sql: string }[];
}

const moduleLoader = Module as unknown as { _load: LoadFunction };
const originalLoad = moduleLoader._load;

class MockMemberEntity {}
class MockSessionEntity {}

class MockSession {
    activities: unknown[];
    client_status: Record<string, string>;
    status: string;
    user_id: string;

    constructor(userId: string, status: string, activities: unknown[] = [], clientStatus: Record<string, string> = {}) {
        this.user_id = userId;
        this.status = status;
        this.activities = activities;
        this.client_status = clientStatus;
    }

    getPublicStatus() {
        return this.status === "invisible" ? "offline" : this.status;
    }
}

const state: {
    guildMembers: Record<string, unknown[]>;
    joinedGuildIds: string[];
    queryCalls: QueryCall[];
    sentPayloads: DispatchPayload[];
    sessions: MockSession[];
} = {
    guildMembers: {},
    joinedGuildIds: [],
    queryCalls: [],
    sentPayloads: [],
    sessions: [],
};

function createQueryBuilder(entity: unknown, alias: string) {
    const call: QueryCall = {
        alias,
        andWheres: [],
        entity,
        joins: [],
        orderBys: [],
        selects: [],
        wheres: [],
    };
    state.queryCalls.push(call);

    const builder = {
        andWhere(sql: string, parameters: unknown) {
            call.andWheres.push({ sql, parameters });
            return builder;
        },
        async getMany() {
            if (entity === MockMemberEntity) {
                const parameters = call.wheres[0]?.parameters as { guild_id?: string; guildIds?: string[] } | undefined;
                if (parameters?.guildIds) return parameters.guildIds.flatMap((guildId) => state.guildMembers[guildId] ?? []);

                return state.guildMembers[parameters?.guild_id ?? ""] ?? [];
            }

            const userIds = ((call.wheres[0]?.parameters as { userIds?: string[] } | undefined)?.userIds ?? []) as string[];
            return state.sessions.filter((session) => userIds.includes(session.user_id));
        },
        async getRawMany() {
            return state.joinedGuildIds.map((guild_id) => ({ guild_id }));
        },
        leftJoinAndSelect(relation: string, joinAlias: string) {
            call.joins.push(`${relation} ${joinAlias}`);
            return builder;
        },
        orderBy(sort: string, direction: string) {
            call.orderBys.push({ sort, direction });
            return builder;
        },
        select(selection: string, selectAlias?: string) {
            call.selects.push({ selection, alias: selectAlias });
            return builder;
        },
        where(sql: string, parameters: unknown) {
            call.wheres.push({ sql, parameters });
            return builder;
        },
    };

    return builder;
}

const mockUtil = {
    Config: {
        get() {
            return { offload: { gateway: { guildSyncUrl: null } } };
        },
    },
    Member: MockMemberEntity,
    Presence: undefined,
    Session: MockSessionEntity,
    Stopwatch: {
        startNew() {
            return {
                elapsed() {
                    return { totalMilliseconds: 1 };
                },
            };
        },
    },
    getDatabase() {
        return {
            getRepository(entity: unknown) {
                return {
                    createQueryBuilder(alias: string) {
                        return createQueryBuilder(entity, alias);
                    },
                };
            },
        };
    },
    getMostRelevantSession(sessions: MockSession[]) {
        const priority: Record<string, number> = { online: 0, idle: 1, dnd: 2, invisible: 3, offline: 4, unknown: 5 };
        return [...sessions].sort((left, right) => priority[left.status] - priority[right.status])[0];
    },
    async timePromise<T>(fn: () => Promise<T>) {
        return { result: await fn(), elapsed: { totalMilliseconds: 1 } };
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
    async handleOffloadedGatewayRequest() {
        throw new Error("offload should not be used in GuildSync tests");
    },
};

moduleLoader._load = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => {
    if (request === "@spacebar/util") return mockUtil;
    if (request === "@spacebar/gateway") return mockGateway;
    if (request === "@spacebar/schemas") return { PublicMember: class {} };

    return originalLoad(request, parent, isMain);
};

const { onGuildSync } = require("./GuildSync") as {
    onGuildSync(this: MockSocket, payload: { d: unknown }): Promise<void>;
};

after(() => {
    moduleLoader._load = originalLoad;
});

beforeEach(() => {
    state.guildMembers = {};
    state.joinedGuildIds = [];
    state.queryCalls = [];
    state.sentPayloads = [];
    state.sessions = [];
});

function member(id: string, guildId: string, username = id) {
    return {
        guild_id: guildId,
        id,
        toPublicMember() {
            return { guild_id: guildId, user: { id, username } };
        },
        user: {
            id,
            toPublicUser() {
                return { id, username };
            },
        },
    };
}

function socket(): MockSocket {
    return { sequence: 0, user_id: "viewer" };
}

async function waitForGuildSyncDispatches(count: number) {
    for (let attempt = 0; attempt < 20; attempt++) {
        if (state.sentPayloads.length >= count) return;
        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });
    }
}

describe("guild sync query loading", () => {
    test("does not query when the request contains no guild ids", async () => {
        await onGuildSync.call(socket(), { d: [] });
        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        assert.equal(state.sentPayloads.length, 0);
        assert.equal(state.queryCalls.length, 0);
    });

    test("syncs only guilds joined by the socket user", async () => {
        state.joinedGuildIds = ["guild-a"];
        state.guildMembers = {
            "guild-a": [member("online-user", "guild-a")],
            "guild-b": [member("outside-user", "guild-b")],
        };
        state.sessions = [new MockSession("online-user", "online", [{ name: "game" }], { web: "online" }), new MockSession("outside-user", "online")];

        await onGuildSync.call(socket(), { d: ["guild-a", "guild-b"] });
        await waitForGuildSyncDispatches(1);

        assert.deepEqual(
            state.queryCalls.map((call) => ({ alias: call.alias, entity: call.entity })),
            [
                { alias: "member", entity: MockMemberEntity },
                { alias: "member", entity: MockMemberEntity },
                { alias: "session", entity: MockSessionEntity },
            ],
        );
        assert.deepEqual(state.queryCalls[0].selects, [{ selection: "member.guild_id", alias: "guild_id" }]);
        assert.deepEqual(state.queryCalls[0].wheres, [{ sql: "member.id = :userId", parameters: { userId: "viewer" } }]);
        assert.deepEqual(state.queryCalls[0].andWheres, [{ sql: "member.guild_id IN (:...guildIds)", parameters: { guildIds: ["guild-a", "guild-b"] } }]);
        assert.deepEqual(state.queryCalls[1].wheres, [{ sql: "member.guild_id IN (:...guildIds)", parameters: { guildIds: ["guild-a"] } }]);
        assert.deepEqual(state.queryCalls[1].joins, ["member.user user", "member.roles role", "member.guild guild"]);
        assert.deepEqual(state.queryCalls[2].wheres, [{ sql: "session.user_id IN (:...userIds)", parameters: { userIds: ["online-user"] } }]);
        assert.deepEqual(state.queryCalls[2].orderBys, [{ sort: "session.user_id", direction: "ASC" }]);

        assert.equal(state.sentPayloads.length, 1);
        assert.equal(state.sentPayloads[0].t, "GUILD_SYNC");
        assert.equal(state.sentPayloads[0].s, 0);
        assert.deepEqual(state.sentPayloads[0].d, {
            id: "guild-a",
            members: [{ guild_id: "guild-a", user: { id: "online-user", username: "online-user" } }],
            presences: [
                {
                    activities: [{ name: "game" }],
                    client_status: { web: "online" },
                    guild_id: "guild-a",
                    status: "online",
                    user: { id: "online-user", username: "online-user" },
                },
            ],
        });
    });

    test("uses the most relevant session and omits presences for members without sessions", async () => {
        state.joinedGuildIds = ["guild"];
        state.guildMembers = {
            guild: [member("multi-session", "guild"), member("offline-member", "guild")],
        };
        state.sessions = [new MockSession("multi-session", "idle"), new MockSession("multi-session", "online")];

        await onGuildSync.call(socket(), { d: ["guild"] });
        await waitForGuildSyncDispatches(1);

        assert.equal(state.sentPayloads.length, 1);
        assert.deepEqual(state.sentPayloads[0].d.presences, [
            {
                activities: [],
                client_status: {},
                guild_id: "guild",
                status: "online",
                user: { id: "multi-session", username: "multi-session" },
            },
        ]);
    });

    test("sends an empty payload without querying sessions when a joined guild has no members", async () => {
        state.joinedGuildIds = ["empty-guild"];
        state.guildMembers = {
            "empty-guild": [],
        };

        await onGuildSync.call(socket(), { d: ["empty-guild"] });
        await waitForGuildSyncDispatches(1);

        assert.equal(state.sentPayloads.length, 1);
        assert.deepEqual(
            state.queryCalls.map((call) => ({ alias: call.alias, entity: call.entity })),
            [
                { alias: "member", entity: MockMemberEntity },
                { alias: "member", entity: MockMemberEntity },
            ],
        );
        assert.deepEqual(state.sentPayloads[0].d, {
            id: "empty-guild",
            members: [],
            presences: [],
        });
    });

    test("batches member and session loading for multiple joined guilds", async () => {
        state.joinedGuildIds = ["guild-a", "guild-b"];
        state.guildMembers = {
            "guild-a": [member("shared-user", "guild-a"), member("guild-a-user", "guild-a")],
            "guild-b": [member("shared-user", "guild-b")],
        };
        state.sessions = [new MockSession("shared-user", "online"), new MockSession("guild-a-user", "idle")];

        await onGuildSync.call(socket(), { d: ["guild-a", "guild-b"] });
        await waitForGuildSyncDispatches(2);

        assert.equal(state.sentPayloads.length, 2);
        assert.deepEqual(
            state.queryCalls.map((call) => ({ alias: call.alias, entity: call.entity })),
            [
                { alias: "member", entity: MockMemberEntity },
                { alias: "member", entity: MockMemberEntity },
                { alias: "session", entity: MockSessionEntity },
            ],
        );
        assert.deepEqual(state.queryCalls[1].wheres, [{ sql: "member.guild_id IN (:...guildIds)", parameters: { guildIds: ["guild-a", "guild-b"] } }]);
        assert.deepEqual(state.queryCalls[2].wheres, [{ sql: "session.user_id IN (:...userIds)", parameters: { userIds: ["shared-user", "guild-a-user"] } }]);
        assert.deepEqual(
            state.sentPayloads.map((payload) => ({ id: payload.d.id, sequence: payload.s })),
            [
                { id: "guild-a", sequence: 0 },
                { id: "guild-b", sequence: 1 },
            ],
        );
        assert.deepEqual(
            state.sentPayloads.map((payload) => payload.d.presences.map((presence) => (presence as { user: { id: string } }).user.id)),
            [["shared-user", "guild-a-user"], ["shared-user"]],
        );
    });

    test("does not issue member or session queries when no requested guilds are joined", async () => {
        state.joinedGuildIds = [];

        await onGuildSync.call(socket(), { d: ["guild"] });
        await waitForGuildSyncDispatches(0);

        assert.equal(state.sentPayloads.length, 0);
        assert.equal(state.queryCalls.length, 1);
    });
});
