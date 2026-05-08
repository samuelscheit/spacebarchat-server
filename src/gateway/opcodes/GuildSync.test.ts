import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import Module from "node:module";

type LoadFunction = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => unknown;
type FindOptions = { where?: Record<string, unknown>; relations?: unknown; select?: unknown; order?: unknown };
type MemberMode = "all" | "online";
type MockRole = { guild_id: string; id: string; position: number };

interface MockPublicUser {
    id: string;
    username: string;
}

interface MockMember {
    guild_id: string;
    id: string;
    roles: MockRole[];
    toPublicMember: () => { guild_id: string; id: string; roles: string[]; user: MockPublicUser };
    user: { toPublicUser: () => MockPublicUser };
}

interface MockSession {
    activities: unknown[];
    client_status: Record<string, string>;
    getPublicStatus: () => string;
    status: string;
    user_id: string;
}

interface MockSocket {
    accessToken: string;
    sequence: number;
    session_id: string;
    user_id: string;
}

const moduleLoader = Module as unknown as { _load: LoadFunction };
const originalLoad = moduleLoader._load;

const state: {
    config: { gateway: { guildSyncMemberMode: MemberMode }; offload: { gateway: { guildSyncUrl: string | null } } };
    handleOffloadedGatewayRequestCalls: { body: unknown; socket: unknown; url: string }[];
    memberFindCalls: FindOptions[];
    membersByGuild: Record<string, MockMember[]>;
    sentPayloads: unknown[];
    sessionFindCalls: FindOptions[];
    sessionsByUserId: Record<string, MockSession[]>;
} = {
    config: { gateway: { guildSyncMemberMode: "all" }, offload: { gateway: { guildSyncUrl: null } } },
    handleOffloadedGatewayRequestCalls: [],
    memberFindCalls: [],
    membersByGuild: {},
    sentPayloads: [],
    sessionFindCalls: [],
    sessionsByUserId: {},
};

function inValues(value: unknown) {
    return value && typeof value === "object" && "__in" in value ? (value as { __in: string[] }).__in : [];
}

function role(id: string, position: number, guildId = "guild"): MockRole {
    return { guild_id: guildId, id, position };
}

function member(guildId: string, userId: string, roles = [role(guildId, 0, guildId)]): MockMember {
    return {
        guild_id: guildId,
        id: userId,
        roles,
        toPublicMember() {
            return {
                guild_id: guildId,
                id: userId,
                roles: roles.filter((memberRole) => memberRole.id !== guildId).map((memberRole) => memberRole.id),
                user: { id: userId, username: `${userId}-name` },
            };
        },
        user: {
            toPublicUser() {
                return { id: userId, username: `${userId}-name` };
            },
        },
    };
}

function session(userId: string, status = "online"): MockSession {
    return {
        activities: [{ name: `${userId}-activity` }],
        client_status: { web: status },
        getPublicStatus() {
            return status === "invisible" ? "offline" : status;
        },
        status,
        user_id: userId,
    };
}

function flushGuildSyncTasks() {
    return new Promise<void>((resolve) => {
        setImmediate(resolve);
    });
}

function socket(): MockSocket {
    return {
        accessToken: "token",
        sequence: 0,
        session_id: "session",
        user_id: "viewer",
    };
}

const mockUtil = {
    Config: {
        get() {
            return state.config;
        },
    },
    Member: {
        async find(options: FindOptions) {
            state.memberFindCalls.push(options);
            const where = options.where ?? {};
            const guildId = where.guild_id;

            if (where.id === "viewer" && guildId && typeof guildId === "object") {
                return inValues(guildId)
                    .filter((id) => state.membersByGuild[id]?.some((guildMember) => guildMember.id === "viewer"))
                    .map((id) => ({ guild_id: id }));
            }

            if (typeof guildId === "string") return state.membersByGuild[guildId] ?? [];
            return [];
        },
    },
    Presence: undefined,
    Session: {
        async find(options: FindOptions) {
            state.sessionFindCalls.push(options);
            const userIds = inValues(options.where?.user_id);
            return userIds.flatMap((userId) => state.sessionsByUserId[userId] ?? []);
        },
    },
    Stopwatch: {
        startNew() {
            return { elapsed: () => ({ totalMilliseconds: 0 }) };
        },
    },
    getMostRelevantSession(sessions: MockSession[]) {
        return sessions[0];
    },
    timePromise: async <T>(fn: () => Promise<T>) => ({ result: await fn(), elapsed: { totalMilliseconds: 0 } }),
};

const mockGateway = {
    OPCODES: {
        Dispatch: 0,
    },
    async Send(_socket: MockSocket, payload: unknown) {
        state.sentPayloads.push(payload);
    },
    WebSocket: class {},
    async handleOffloadedGatewayRequest(socket: MockSocket, url: string, body: unknown) {
        state.handleOffloadedGatewayRequestCalls.push({ body, socket, url });
        return "offloaded";
    },
    isPublicOnlineSession(currentSession: MockSession | undefined) {
        return Boolean(currentSession && currentSession.status !== "offline" && currentSession.status !== "invisible");
    },
    sortMembersByRole(members: MockMember[]) {
        return [...members].sort((a, b) => Math.max(...b.roles.map((memberRole) => memberRole.position)) - Math.max(...a.roles.map((memberRole) => memberRole.position)));
    },
};

moduleLoader._load = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => {
    if (request === "@spacebar/util") return mockUtil;
    if (request === "@spacebar/gateway") return mockGateway;
    if (request === "@spacebar/schemas") return {};
    if (request === "typeorm") return { In: (values: string[]) => ({ __in: values }) };

    return originalLoad(request, parent, isMain);
};

const { buildGuildSyncResult, onGuildSync } = require("./GuildSync") as {
    buildGuildSyncResult(
        guildId: string,
        members: MockMember[],
        sessions: MockSession[],
        memberMode?: MemberMode,
    ): {
        id: string;
        members: ReturnType<MockMember["toPublicMember"]>[];
        presences: { status: string; user: MockPublicUser }[];
    };
    onGuildSync(this: MockSocket, payload: { d: unknown }): Promise<unknown>;
};

after(() => {
    moduleLoader._load = originalLoad;
});

beforeEach(() => {
    state.config = { gateway: { guildSyncMemberMode: "all" }, offload: { gateway: { guildSyncUrl: null } } };
    state.handleOffloadedGatewayRequestCalls = [];
    state.memberFindCalls = [];
    state.membersByGuild = {
        joined: [member("joined", "viewer"), member("joined", "visible-member"), member("joined", "private-channel-member")],
        unjoined: [member("unjoined", "other-member")],
    };
    state.sentPayloads = [];
    state.sessionFindCalls = [];
    state.sessionsByUserId = {
        "private-channel-member": [session("private-channel-member", "idle")],
        "visible-member": [session("visible-member", "online")],
    };
});

function memberIds(result: ReturnType<typeof buildGuildSyncResult>) {
    return result.members.map((publicMember) => publicMember.user?.id);
}

describe("buildGuildSyncResult", () => {
    test("keeps all members by default while sorting by highest role", () => {
        const everyone = role("guild", 0);
        const admin = role("admin", 10);
        const moderator = role("moderator", 5);
        const members = [member("guild", "plain", [everyone]), member("guild", "admin", [everyone, admin]), member("guild", "mod", [everyone, moderator])];

        const result = buildGuildSyncResult("guild", members, [session("plain", "online"), session("admin", "offline"), session("mod", "idle")]);

        assert.deepEqual(memberIds(result), ["admin", "mod", "plain"]);
        assert.deepEqual(
            result.presences.map((presence) => presence.user.id),
            ["mod", "plain"],
        );
    });

    test("can limit members to users with public online sessions", () => {
        const everyone = role("guild", 0);
        const admin = role("admin", 10);
        const members = [member("guild", "offline-admin", [everyone, admin]), member("guild", "online-user", [everyone])];

        const result = buildGuildSyncResult("guild", members, [session("offline-admin", "invisible"), session("online-user", "online")], "online");

        assert.deepEqual(memberIds(result), ["online-user"]);
        assert.deepEqual(
            result.presences.map((presence) => [presence.user.id, presence.status]),
            [["online-user", "online"]],
        );
    });
});

describe("GUILD_SYNC", () => {
    test("rejects non-array payloads before querying", async () => {
        await assert.rejects(onGuildSync.call(socket(), { d: { guild_id: "joined" } }), /Invalid payload for GUILD_SYNC/);

        assert.deepEqual(state.memberFindCalls, []);
        assert.deepEqual(state.sentPayloads, []);
    });

    test("dispatches guild-scoped members and presences only for joined requested guilds", async () => {
        const activeSocket = socket();
        await onGuildSync.call(activeSocket, { d: ["joined", "unjoined"] });
        await flushGuildSyncTasks();

        assert.equal(state.sentPayloads.length, 1);
        assert.deepEqual(
            state.memberFindCalls.map((call) => call.where),
            [{ id: "viewer", guild_id: { __in: ["joined", "unjoined"] } }, { guild_id: "joined" }],
        );
        assert.deepEqual(
            state.sessionFindCalls.map((call) => call.where),
            [{ user_id: { __in: ["viewer", "visible-member", "private-channel-member"] } }],
        );

        const payload = state.sentPayloads[0] as {
            d: { id: string; members: { id: string }[]; presences: { status: string; user: { id: string } }[] };
            op: number;
            s: number;
            t: string;
        };
        assert.equal(payload.op, 0);
        assert.equal(payload.t, "GUILD_SYNC");
        assert.equal(payload.s, 0);
        assert.equal(activeSocket.sequence, 1);
        assert.equal(payload.d.id, "joined");
        assert.deepEqual(
            payload.d.members.map((guildMember) => guildMember.id),
            ["viewer", "visible-member", "private-channel-member"],
        );
        assert.deepEqual(payload.d.presences, [
            {
                user: { id: "visible-member", username: "visible-member-name" },
                guild_id: "joined",
                status: "online",
                activities: [{ name: "visible-member-activity" }],
                client_status: { web: "online" },
            },
            {
                user: { id: "private-channel-member", username: "private-channel-member-name" },
                guild_id: "joined",
                status: "idle",
                activities: [{ name: "private-channel-member-activity" }],
                client_status: { web: "idle" },
            },
        ]);
    });

    test("offloads configured requests without local membership or session queries", async () => {
        state.config = { gateway: { guildSyncMemberMode: "all" }, offload: { gateway: { guildSyncUrl: "http://offload.example/guild-sync" } } };
        const activeSocket = socket();

        const result = await onGuildSync.call(activeSocket, { d: ["joined"] });

        assert.equal(result, "offloaded");
        assert.deepEqual(state.handleOffloadedGatewayRequestCalls, [{ socket: activeSocket, url: "http://offload.example/guild-sync", body: ["joined"] }]);
        assert.deepEqual(state.memberFindCalls, []);
        assert.deepEqual(state.sessionFindCalls, []);
        assert.deepEqual(state.sentPayloads, []);
    });
});
