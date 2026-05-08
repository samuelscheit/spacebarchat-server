import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import Module from "node:module";

type LoadFunction = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => unknown;
type Range = [number, number];
type MockSessionStatus = "idle" | "dnd" | "online" | "offline" | "invisible" | "unknown";

interface MockSession {
    status: MockSessionStatus;
}

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
        user?: { id: string };
    };
    op: number;
    s: number;
    t: string;
}

interface MockSocket {
    close: () => void;
    events: Record<string, unknown>;
    listen_options: Record<string, unknown>;
    guild_member_event_ids: Record<string, Set<string>>;
    intents: { has(flag: bigint): boolean };
    member_event_guild_ids: Record<string, Set<string>>;
    member_events: Record<string, () => Promise<unknown>>;
    sequence: number;
    user_id: string;
}

const GUILD_PRESENCES = 1n << 8n;
const moduleLoader = Module as unknown as { _load: LoadFunction };
const originalLoad = moduleLoader._load;

const state: {
    buildCalls: { guildId: string; members: unknown[]; ranges: Range[] }[];
    buildOptions: { includePresences?: boolean }[];
    channelOverwrites: { allow: string; deny: string; id: string }[] | undefined;
    findCalls: unknown[];
    guildOwnerLookups: number;
    includeOfflineLazyMembers: boolean | undefined;
    guildMembers: unknown[];
    memberCount: number;
    memberListResult: MockMemberListResult;
    omitPermissionGuildCache: boolean;
    offloadCalls: { body: unknown; socket: unknown; url: string }[];
    offloadEvents: { data?: unknown; event: string }[];
    offloadUrl: string | null;
    permissionError: Error | undefined;
    permissionChecks: string[];
    permissionRequests: { channelId: string; guildId: string; userId: string }[];
    sentPayloads: DispatchPayload[];
    subscriptions: string[];
    unsubscriptions: string[];
} = {
    buildCalls: [],
    buildOptions: [],
    channelOverwrites: undefined,
    findCalls: [],
    guildOwnerLookups: 0,
    includeOfflineLazyMembers: true,
    guildMembers: [],
    memberCount: 0,
    memberListResult: { groups: [], online_count: 0, ops: [] },
    omitPermissionGuildCache: false,
    offloadCalls: [],
    offloadEvents: [],
    offloadUrl: null,
    permissionError: undefined,
    permissionChecks: [],
    permissionRequests: [],
    sentPayloads: [],
    subscriptions: [],
    unsubscriptions: [],
};

const mockUtil = {
    Config: {
        get() {
            return {
                gateway: {
                    lazyMemberListIncludeOffline: state.includeOfflineLazyMembers,
                },
                offload: {
                    gateway: {
                        lazyRequestUrl: state.offloadUrl,
                    },
                },
            };
        },
    },
    Channel: {
        async findOneOrFail() {
            return { permission_overwrites: state.channelOverwrites };
        },
    },
    Guild: {
        async findOneOrFail() {
            state.guildOwnerLookups++;
            return { id: "guild", owner_id: "owner" };
        },
    },
    Intents: {
        FLAGS: {
            GUILD_PRESENCES,
        },
    },
    Member: {
        async count() {
            return state.memberCount;
        },
        async find(options: unknown) {
            state.findCalls.push(options);
            return state.guildMembers;
        },
        async findOne({ where }: { where: { guild_id: string; id: string } }) {
            return state.guildMembers.some((member) => (member as { id?: string }).id === where.id) ? { id: where.id } : null;
        },
    },
    Permissions: {
        FLAGS: {
            VIEW_CHANNEL: 1n,
        },
        finalPermission({
            user,
            guild,
            channel,
        }: {
            channel: { overwrites?: { allow: string; deny: string; id: string }[] };
            guild: { owner_id: string; roles: { id: string; permissions?: string }[] };
            user: { id: string; roles: string[] };
        }) {
            if (guild.owner_id === user.id) {
                return {
                    has(permission: string) {
                        return permission === "VIEW_CHANNEL";
                    },
                };
            }

            let bitfield = guild.roles.filter((role) => user.roles.includes(role.id)).reduce((permissions, role) => permissions | BigInt(role.permissions ?? "0"), 0n);
            for (const overwrite of channel.overwrites ?? []) {
                if (user.roles.includes(overwrite.id)) bitfield = (bitfield & ~BigInt(overwrite.deny)) | BigInt(overwrite.allow);
            }
            return {
                has(permission: string) {
                    return permission === "VIEW_CHANNEL" && (bitfield & 1n) === 1n;
                },
            };
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
    getMostRelevantSession() {
        return undefined;
    },
    async getPermission(userId: string, guildId: string, channelId: string) {
        state.permissionRequests.push({ channelId, guildId, userId });
        if (userId !== "viewer" && !state.guildMembers.some((member) => (member as { id?: string }).id === userId)) throw new Error("missing guild access");

        return {
            cache: {
                channel: {
                    guild_id: guildId,
                    id: channelId,
                    permission_overwrites: state.channelOverwrites,
                },
                guild: state.omitPermissionGuildCache ? undefined : { owner_id: "owner" },
            },
            hasThrow(permission: string) {
                state.permissionChecks.push(permission);
                if (state.permissionError) throw state.permissionError;
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
    buildLazyMemberListOperations(members: unknown[], guildId: string, ranges: Range[], options: { includePresences?: boolean }) {
        state.buildCalls.push({ guildId, members, ranges });
        state.buildOptions.push(options);
        return state.memberListResult;
    },
    async handleOffloadedGatewayRequest(socket: MockSocket, url: string, body: unknown, onEvent?: (event: { data?: unknown; event: string }) => Promise<void> | void) {
        state.offloadCalls.push({ body, socket, url });
        for (const event of state.offloadEvents) await onEvent?.(event);
        return "offloaded";
    },
    async subscribeGuildMemberEvent(this: MockSocket, guildId: string, userId: string) {
        if (this.guild_member_event_ids[guildId]?.has(userId)) return false;

        this.guild_member_event_ids[guildId] ??= new Set();
        this.guild_member_event_ids[guildId].add(userId);
        this.member_event_guild_ids[userId] ??= new Set();
        this.member_event_guild_ids[userId].add(guildId);
        this.member_events[userId] ??= async () => {
            state.unsubscriptions.push(userId);
        };
        state.subscriptions.push(userId);
        return true;
    },
};

moduleLoader._load = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => {
    if (request === "@spacebar/util") return mockUtil;
    if (request === "@spacebar/gateway") return mockGateway;
    if (request === "@spacebar/schemas") return { LazyRequestSchema: {} };
    if (request === "./instanceOf" && /\/LazyRequest\.[jt]s$/.test(parent?.filename ?? "")) return { check: () => true };

    return originalLoad(request, parent, isMain);
};

const { onLazyRequest } = require("./LazyRequest") as {
    onLazyRequest(this: MockSocket, payload: { d: unknown }): Promise<unknown>;
};

after(() => {
    moduleLoader._load = originalLoad;
});

function memberRole(id: string, permissions: string, position = 0) {
    return { guild_id: "guild", id, permissions, position };
}

function session(status: MockSessionStatus): MockSession {
    return { status };
}

function viewableMember(id: string, roles = [memberRole("guild", mockUtil.Permissions.FLAGS.VIEW_CHANNEL.toString())], sessions: MockSession[] = []) {
    return {
        id,
        guild_id: "guild",
        communication_disabled_until: null,
        roles,
        user: { flags: 0, sessions },
    };
}

beforeEach(() => {
    state.buildCalls = [];
    state.buildOptions = [];
    state.channelOverwrites = undefined;
    state.findCalls = [];
    state.guildOwnerLookups = 0;
    state.includeOfflineLazyMembers = true;
    state.guildMembers = [viewableMember("online-user"), viewableMember("offline-user")];
    state.memberCount = 3;
    state.memberListResult = { groups: [], online_count: 0, ops: [] };
    state.omitPermissionGuildCache = false;
    state.offloadCalls = [];
    state.offloadEvents = [];
    state.offloadUrl = null;
    state.permissionError = undefined;
    state.permissionChecks = [];
    state.permissionRequests = [];
    state.sentPayloads = [];
    state.subscriptions = [];
    state.unsubscriptions = [];
});

function socket(intentBits = GUILD_PRESENCES): MockSocket {
    return {
        close() {
            throw new Error("validation should be mocked in LazyRequest tests");
        },
        events: {},
        guild_member_event_ids: {},
        intents: {
            has(flag: bigint) {
                return (intentBits & flag) === flag;
            },
        },
        listen_options: {},
        member_event_guild_ids: {},
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
    test("offloads configured lazy requests without local permission or member-list queries", async () => {
        state.offloadUrl = "http://offload.example/lazy-request";
        const activeSocket = socket();
        const body = { channels: { channel: [[0, 0] as Range] }, guild_id: "guild" };

        const result = await onLazyRequest.call(activeSocket, { d: body });

        assert.equal(result, "offloaded");
        assert.deepEqual(state.offloadCalls, [{ body: { ...body, include_presences: true }, socket: activeSocket, url: "http://offload.example/lazy-request" }]);
        assert.deepEqual(state.permissionChecks, []);
        assert.equal(state.findCalls.length, 0);
        assert.deepEqual(state.buildCalls, []);
        assert.deepEqual(state.sentPayloads, []);
    });

    test("tracks lazy member subscriptions from offloaded events", async () => {
        state.offloadUrl = "http://offload.example/lazy-request";
        state.offloadEvents = [
            {
                event: "GUILD_MEMBER_LIST_UPDATE",
                data: {
                    ops: [
                        {
                            items: [{ group: { count: 2, id: "online" } }, { member: { user: { id: "visible-user" } } }, { member: { user: { id: 42 } } }],
                        },
                    ],
                },
            },
            {
                event: "PRESENCE_UPDATE",
                data: { user: { id: "presence-user" } },
            },
        ];
        const activeSocket = socket();
        activeSocket.member_events = {
            "stale-user": async () => state.unsubscriptions.push("stale-user"),
        };
        activeSocket.guild_member_event_ids = {
            guild: new Set(["stale-user"]),
        };
        activeSocket.member_event_guild_ids = {
            "stale-user": new Set(["guild"]),
        };

        await onLazyRequest.call(activeSocket, { d: { channels: { channel: [[0, 0] as Range] }, guild_id: "guild" } });

        assert.deepEqual(state.permissionChecks, []);
        assert.equal(state.findCalls.length, 0);
        assert.deepEqual(state.subscriptions, ["visible-user", "42", "presence-user"]);
        assert.deepEqual(state.unsubscriptions, ["stale-user"]);
        assert.deepEqual(activeSocket.guild_member_event_ids, {
            guild: new Set(["visible-user", "42", "presence-user"]),
        });
        assert.deepEqual(activeSocket.member_event_guild_ids, {
            "visible-user": new Set(["guild"]),
            "42": new Set(["guild"]),
            "presence-user": new Set(["guild"]),
        });
        assert.deepEqual(Object.keys(activeSocket.member_events).sort(), ["42", "presence-user", "visible-user"]);
    });

    test("passes the absence of guild presences intent to offloaded lazy requests", async () => {
        state.offloadUrl = "http://offload.example/lazy-request";
        state.offloadEvents = [
            {
                event: "GUILD_MEMBER_LIST_UPDATE",
                data: {
                    ops: [{ items: [{ member: { user: { id: "visible-user" } } }] }],
                },
            },
        ];
        const activeSocket = socket(0n);
        activeSocket.guild_member_event_ids = { guild: new Set(["stale-user"]) };
        activeSocket.member_event_guild_ids = { "stale-user": new Set(["guild"]) };
        activeSocket.member_events = { "stale-user": async () => state.unsubscriptions.push("stale-user") };

        await onLazyRequest.call(activeSocket, { d: { channels: { channel: [[0, 0] as Range] }, guild_id: "guild" } });

        assert.deepEqual(state.offloadCalls[0].body, {
            channels: { channel: [[0, 0]] },
            guild_id: "guild",
            include_presences: false,
        });
        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(state.unsubscriptions, ["stale-user"]);
    });

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

        assert.deepEqual(state.findCalls, [
            {
                where: { guild_id: "guild" },
                relations: {
                    roles: true,
                    user: {
                        sessions: true,
                        settings: true,
                    },
                },
            },
        ]);
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
        assert.equal(payload.d.member_count, 2);
        assert.deepEqual(payload.d.groups, [{ count: 1, id: "online" }]);
        assert.deepEqual(state.subscriptions, ["online-user"]);
    });

    test("keeps the default lazy member load configured to include offline members", async () => {
        state.guildMembers = [viewableMember("online-user", undefined, [session("online")]), viewableMember("offline-user", undefined, [session("offline")])];

        await onLazyRequest.call(socket(), { d: { channels: { channel: [[0, 0]] }, guild_id: "guild" } });

        assert.deepEqual(
            state.buildCalls[0].members.map((member) => (member as { id: string }).id),
            ["online-user", "offline-user"],
        );
    });

    test("keeps backward-compatible include-offline behavior when older configs omit the lazy member flag", async () => {
        state.includeOfflineLazyMembers = undefined;
        state.guildMembers = [viewableMember("online-user", undefined, [session("online")]), viewableMember("offline-user", undefined, [session("offline")])];

        await onLazyRequest.call(socket(), { d: { channels: { channel: [[0, 0]] }, guild_id: "guild" } });

        assert.deepEqual(
            state.buildCalls[0].members.map((member) => (member as { id: string }).id),
            ["online-user", "offline-user"],
        );
    });

    test("passes only members with non-offline sessions to the member list builder when offline lazy members are disabled", async () => {
        state.includeOfflineLazyMembers = false;
        state.guildMembers = [
            viewableMember("online-user", undefined, [session("online")]),
            viewableMember("offline-user", undefined, [session("offline")]),
            viewableMember("no-session-user"),
            viewableMember("mixed-user", undefined, [session("offline"), session("dnd")]),
            viewableMember("invisible-user", undefined, [session("invisible")]),
            viewableMember("idle-user", undefined, [session("idle")]),
        ];

        await onLazyRequest.call(socket(), { d: { channels: { channel: [[0, 0]] }, guild_id: "guild" } });

        assert.deepEqual(
            state.buildCalls[0].members.map((member) => (member as { id: string }).id),
            ["online-user", "mixed-user", "idle-user"],
        );
        assert.equal(sentUpdate().d.member_count, 3);
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

        assert.equal(state.findCalls.length, 1);
        assert.deepEqual(state.buildCalls, [{ guildId: "guild", members: state.guildMembers, ranges: [] }]);

        const payload = sentUpdate();
        assert.deepEqual(payload.d.ops, []);
        assert.equal(payload.d.online_count, 1);
        assert.equal(payload.d.member_count, 2);
        assert.deepEqual(payload.d.groups, [
            { count: 1, id: "online" },
            { count: 2, id: "offline" },
        ]);
    });

    test("rejects malformed member list ranges before loading guild members", async () => {
        for (const range of [[[0]], [[0, 1, 2]], [[0, "1"]], [[1.5, 2]], [[-1, 2]], [[3, 2]]] as unknown[][]) {
            const activeSocket = socket();
            activeSocket.member_events = {
                "stale-user": async () => state.unsubscriptions.push("stale-user"),
            };
            activeSocket.guild_member_event_ids = { guild: new Set(["stale-user"]) };
            activeSocket.member_event_guild_ids = { "stale-user": new Set(["guild"]) };

            state.buildCalls = [];
            state.findCalls = [];
            state.permissionChecks = [];
            state.permissionRequests = [];
            state.sentPayloads = [];
            state.subscriptions = [];
            state.unsubscriptions = [];

            await assert.rejects(onLazyRequest.call(activeSocket, { d: { channels: { channel: range }, guild_id: "guild" } }), /range/);

            assert.deepEqual(state.permissionRequests, [], `range ${JSON.stringify(range)} should not request channel access`);
            assert.deepEqual(state.permissionChecks, [], `range ${JSON.stringify(range)} should not authorize channel access`);
            assert.equal(state.findCalls.length, 0, `range ${JSON.stringify(range)} should not query members`);
            assert.deepEqual(state.buildCalls, [], `range ${JSON.stringify(range)} should not build member list ops`);
            assert.deepEqual(state.subscriptions, [], `range ${JSON.stringify(range)} should not subscribe to members`);
            assert.deepEqual(state.unsubscriptions, [], `range ${JSON.stringify(range)} should not unsubscribe stale members`);
            assert.deepEqual(state.sentPayloads, [], `range ${JSON.stringify(range)} should not dispatch updates`);
        }
    });

    test("rejects non-array channel range payloads before authorization side effects", async () => {
        await assert.rejects(onLazyRequest.call(socket(), { d: { channels: { channel: {} }, guild_id: "guild" } }), /range list/);

        assert.deepEqual(state.permissionChecks, []);
        assert.deepEqual(state.permissionRequests, []);
        assert.equal(state.findCalls.length, 0);
        assert.deepEqual(state.buildCalls, []);
        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(state.sentPayloads, []);
    });

    test("rejects non-array member presence requests before authorization side effects", async () => {
        await assert.rejects(
            onLazyRequest.call(socket(), {
                d: {
                    channels: { channel: [] },
                    guild_id: "guild",
                    members: "target-user",
                },
            }),
            /members/,
        );

        assert.deepEqual(state.permissionChecks, []);
        assert.deepEqual(state.permissionRequests, []);
        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(state.sentPayloads, []);
        assert.equal(state.findCalls.length, 0);
        assert.deepEqual(state.buildCalls, []);
    });

    test("rejects non-string member presence requests before authorization side effects", async () => {
        await assert.rejects(
            onLazyRequest.call(socket(), {
                d: {
                    channels: { channel: [] },
                    guild_id: "guild",
                    members: [123],
                },
            }),
            /member id/,
        );

        assert.deepEqual(state.permissionChecks, []);
        assert.deepEqual(state.permissionRequests, []);
        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(state.sentPayloads, []);
        assert.equal(state.findCalls.length, 0);
        assert.deepEqual(state.buildCalls, []);
    });

    test("checks channel visibility before subscribing to requested member presences", async () => {
        state.permissionError = new Error("missing VIEW_CHANNEL");

        await assert.rejects(
            onLazyRequest.call(socket(), {
                d: {
                    channels: { private: [[0, 0]] },
                    guild_id: "guild",
                    members: ["target-user"],
                },
            }),
            /missing VIEW_CHANNEL/,
        );

        assert.deepEqual(state.permissionChecks, ["VIEW_CHANNEL"]);
        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(state.sentPayloads, []);
        assert.equal(state.findCalls.length, 0);
    });

    test("does not subscribe to requested presences for users outside the authorized guild", async () => {
        state.guildMembers = [viewableMember("guild-member")];

        await onLazyRequest.call(socket(), {
            d: {
                channels: { channel: [] },
                guild_id: "guild",
                members: ["outside-user"],
            },
        });

        assert.deepEqual(state.permissionChecks, ["VIEW_CHANNEL"]);
        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(
            state.sentPayloads.filter((payload) => payload.t === "PRESENCE_UPDATE"),
            [],
        );
    });

    test("does not send immediate presence snapshots without the guild presences intent", async () => {
        await onLazyRequest.call(socket(0n), {
            d: {
                channels: { channel: [] },
                guild_id: "guild",
                members: ["online-user"],
            },
        });

        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(
            state.sentPayloads.filter((payload) => payload.t === "PRESENCE_UPDATE"),
            [],
        );
    });

    test("builds member lists without presence data or presence subscriptions when the intent is absent", async () => {
        state.memberListResult = {
            groups: [{ count: 2, id: "offline" }],
            online_count: 0,
            ops: [memberListOp([0, 1], [{ user: { id: "online-user" } }])],
        };

        await onLazyRequest.call(socket(0n), { d: { channels: { channel: [[0, 1]] }, guild_id: "guild" } });

        assert.deepEqual(state.buildOptions, [{ includePresences: false }]);
        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(state.unsubscriptions, []);
        const payload = sentUpdate();
        assert.equal(payload.t, "GUILD_MEMBER_LIST_UPDATE");
        assert.equal(payload.d.online_count, 0);
        assert.deepEqual(payload.d.groups, [{ count: 2, id: "offline" }]);
    });

    test("sends immediate presence snapshots with the guild presences intent", async () => {
        await onLazyRequest.call(socket(GUILD_PRESENCES), {
            d: {
                channels: { channel: [] },
                guild_id: "guild",
                members: ["online-user"],
            },
        });

        const presenceUpdates = state.sentPayloads.filter((payload) => payload.t === "PRESENCE_UPDATE");
        assert.equal(presenceUpdates.length, 1);
        assert.equal(presenceUpdates[0].d.user?.id, "online-user");
    });

    test("filters member list entries through the authorized channel overwrites", async () => {
        const view = mockUtil.Permissions.FLAGS.VIEW_CHANNEL.toString();
        state.channelOverwrites = [{ id: "denied-role", allow: "0", deny: view }];
        state.guildMembers = [viewableMember("visible-user"), viewableMember("hidden-user", [memberRole("guild", view), memberRole("denied-role", "0", 1)])];
        state.memberListResult = {
            groups: [{ count: 1, id: "online" }],
            online_count: 1,
            ops: [memberListOp([0, 1], [{ user: { id: "visible-user" } }])],
        };

        await onLazyRequest.call(socket(), { d: { channels: { channel: [[0, 1]] }, guild_id: "guild" } });

        assert.deepEqual(state.buildCalls, [{ guildId: "guild", members: [state.guildMembers[0]], ranges: [[0, 1]] }]);
        const payload = sentUpdate();
        assert.equal(payload.d.member_count, 1);
    });

    test("filters member list entries that lack base channel visibility", async () => {
        state.guildMembers = [viewableMember("visible-user"), viewableMember("hidden-user", [memberRole("guild", "0")])];
        state.memberListResult = {
            groups: [{ count: 1, id: "online" }],
            online_count: 1,
            ops: [memberListOp([0, 1], [{ user: { id: "visible-user" } }])],
        };

        await onLazyRequest.call(socket(), { d: { channels: { channel: [[0, 1]] }, guild_id: "guild" } });

        assert.deepEqual(state.buildCalls, [{ guildId: "guild", members: [state.guildMembers[0]], ranges: [[0, 1]] }]);
        const payload = sentUpdate();
        assert.equal(payload.d.member_count, 1);
    });

    test("uses the authorized guild owner id when permission cache omits guild data", async () => {
        state.omitPermissionGuildCache = true;
        state.guildMembers = [
            {
                id: "owner",
                guild_id: "guild",
                communication_disabled_until: null,
                roles: [],
                user: { flags: 0 },
            },
            viewableMember("hidden-user", [memberRole("guild", "0")]),
        ];
        state.memberListResult = {
            groups: [{ count: 1, id: "online" }],
            online_count: 1,
            ops: [memberListOp([0, 1], [{ user: { id: "owner" } }])],
        };

        await onLazyRequest.call(socket(), { d: { channels: { channel: [[0, 1]] }, guild_id: "guild" } });

        assert.equal(state.guildOwnerLookups, 1);
        assert.deepEqual(state.buildCalls, [{ guildId: "guild", members: [state.guildMembers[0]], ranges: [[0, 1]] }]);
        const payload = sentUpdate();
        assert.equal(payload.d.member_count, 1);
    });

    test("unsubscribes stale lazy presence subscriptions outside the authorized member list", async () => {
        state.memberListResult = {
            groups: [{ count: 1, id: "online" }],
            online_count: 1,
            ops: [memberListOp([0, 0], [{ user: { id: "visible-user" } }])],
        };
        const activeSocket = socket();
        activeSocket.member_events = {
            "shared-user": async () => state.unsubscriptions.push("shared-user"),
            "stale-user": async () => state.unsubscriptions.push("stale-user"),
        };
        activeSocket.guild_member_event_ids = {
            guild: new Set(["shared-user", "stale-user"]),
            "other-guild": new Set(["shared-user"]),
        };
        activeSocket.member_event_guild_ids = {
            "shared-user": new Set(["guild", "other-guild"]),
            "stale-user": new Set(["guild"]),
        };

        await onLazyRequest.call(activeSocket, { d: { channels: { channel: [[0, 0]] }, guild_id: "guild" } });

        assert.deepEqual(state.subscriptions, ["visible-user"]);
        assert.deepEqual(state.unsubscriptions, ["stale-user"]);
        assert.deepEqual(activeSocket.guild_member_event_ids, {
            guild: new Set(["visible-user"]),
            "other-guild": new Set(["shared-user"]),
        });
        assert.deepEqual(activeSocket.member_event_guild_ids, {
            "shared-user": new Set(["other-guild"]),
            "visible-user": new Set(["guild"]),
        });
        assert.deepEqual(Object.keys(activeSocket.member_events).sort(), ["shared-user", "visible-user"]);
    });

    test("accepts no-op typing and activities compatibility flags without extra lazy side effects", async () => {
        await onLazyRequest.call(socket(), {
            d: {
                activities: true,
                guild_id: "guild",
                typing: true,
            },
        });

        assert.deepEqual(state.permissionChecks, []);
        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(state.sentPayloads, []);
        assert.equal(state.findCalls.length, 0);
        assert.equal(state.buildCalls.length, 0);
    });

    test("ignores member presence requests that do not include an authorized channel", async () => {
        await onLazyRequest.call(socket(), {
            d: {
                guild_id: "guild",
                members: ["target-user"],
            },
        });

        assert.deepEqual(state.permissionChecks, []);
        assert.deepEqual(state.permissionRequests, []);
        assert.deepEqual(state.subscriptions, []);
        assert.deepEqual(state.sentPayloads, []);
        assert.equal(state.findCalls.length, 0);
    });
});
