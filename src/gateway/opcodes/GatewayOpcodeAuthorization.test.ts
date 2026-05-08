import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import Module from "node:module";

type LoadFunction = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => unknown;

type MockChannel = {
    guild_id?: string | null;
    id: string;
    permission_overwrites?: unknown[];
    type: number;
};

interface MockSocket {
    closed?: { code: number; reason?: string };
    close: (code: number, reason?: string) => void;
    events: Record<string, unknown>;
    listen_options: Record<string, unknown>;
    member_events: Record<string, unknown>;
    sequence: number;
    session_id: string;
    user_id: string;
}

const moduleLoader = Module as unknown as { _load: LoadFunction };
const originalLoad = moduleLoader._load;

const ChannelType = {
    GUILD_TEXT: 0,
    DM: 1,
    GUILD_VOICE: 2,
    GROUP_DM: 3,
    GUILD_STAGE_VOICE: 13,
};

const state: {
    channels: Record<string, MockChannel>;
    emittedEvents: unknown[];
    generatedTokens: string[];
    memberFindOneCalls: unknown[];
    memberFindOneResult: { toPublicMember: () => unknown } | null | undefined;
    permissionError: Error | undefined;
    permissionCalls: { channelId: string; guildId?: string; permission?: unknown; userId: string }[];
    streamDeleteCalls: unknown[];
    streamFindCalls: unknown[];
    streamSaves: unknown[];
    streamSessionSaves: unknown[];
    voiceCreateCalls: unknown[];
    voiceFindOneCalls: unknown[];
    voiceFindOneOrFailCalls: unknown[];
    voiceSaves: unknown[];
    voiceState: ReturnType<typeof makeVoiceState> | undefined;
} = {
    channels: {},
    emittedEvents: [],
    generatedTokens: [],
    memberFindOneCalls: [],
    memberFindOneResult: undefined,
    permissionError: undefined,
    permissionCalls: [],
    streamDeleteCalls: [],
    streamFindCalls: [],
    streamSaves: [],
    streamSessionSaves: [],
    voiceCreateCalls: [],
    voiceFindOneCalls: [],
    voiceFindOneOrFailCalls: [],
    voiceSaves: [],
    voiceState: undefined,
};

function makeVoiceState(props: Record<string, unknown>) {
    return {
        deaf: false,
        channel_id: undefined as string | undefined | null,
        guild_id: undefined as string | undefined | null,
        mute: false,
        self_deaf: false,
        self_mute: false,
        self_stream: false,
        self_video: false,
        session_id: "old-session",
        suppress: false,
        token: undefined as string | undefined,
        user_id: "viewer",
        ...props,
        async save() {
            state.voiceSaves.push({ ...this });
        },
        toPublicVoiceState() {
            return {
                channel_id: this.channel_id,
                guild_id: this.guild_id,
                session_id: this.session_id,
                user_id: this.user_id,
            };
        },
    };
}

function makeSocket(): MockSocket {
    return {
        close(code: number, reason?: string) {
            this.closed = { code, reason };
        },
        events: {},
        listen_options: {},
        member_events: {},
        sequence: 0,
        session_id: "session",
        user_id: "viewer",
    };
}

function defaultChannel(id = "voice", guildId: string | null = "guild"): MockChannel {
    return {
        guild_id: guildId,
        id,
        permission_overwrites: [],
        type: guildId ? ChannelType.GUILD_VOICE : ChannelType.DM,
    };
}

const mockUtil = {
    Channel: {
        async findOneOrFail({ where }: { where: { id: string } }) {
            const channel = state.channels[where.id];
            if (!channel) throw new Error("channel not found");
            return channel;
        },
    },
    Config: {
        get() {
            return {
                regions: {
                    default: "local",
                    available: [{ endpoint: "rtc.local", id: "local", name: "Local" }],
                },
            };
        },
    },
    Guild: {
        async findOne() {
            return { id: "guild", region: "local" };
        },
        async findOneOrFail() {
            return { id: "guild", owner_id: "owner", region: "local" };
        },
    },
    Member: {
        async findOne(options: unknown) {
            state.memberFindOneCalls.push(options);
            if (state.memberFindOneResult !== undefined) return state.memberFindOneResult;
            return {
                toPublicMember() {
                    return { user: { id: "viewer" } };
                },
            };
        },
        async findOneOrFail(options: unknown) {
            state.memberFindOneCalls.push(options);
            return {
                toPublicMember() {
                    return { user: { id: "viewer" } };
                },
            };
        },
    },
    Snowflake: {
        generate() {
            return "stream-id";
        },
    },
    Stream: {
        async delete(criteria: unknown) {
            state.streamDeleteCalls.push(criteria);
        },
        async findOne(options: unknown) {
            state.streamFindCalls.push(options);
            return {
                channel: state.channels.voice,
                channel_id: "voice",
                endpoint: "rtc.local",
                id: "stream-id",
                owner_id: "owner",
            };
        },
        create(props: Record<string, unknown>) {
            return {
                ...props,
                async save() {
                    state.streamSaves.push({ ...this });
                },
            };
        },
    },
    StreamSession: {
        create(props: Record<string, unknown>) {
            return {
                ...props,
                async save() {
                    state.streamSessionSaves.push({ ...this });
                },
            };
        },
        async find() {
            return [];
        },
    },
    VoiceState: {
        create(props: Record<string, unknown>) {
            state.voiceCreateCalls.push(props);
            return makeVoiceState(props);
        },
        async findOne(options: unknown) {
            state.voiceFindOneCalls.push(options);
            return state.voiceState;
        },
        async findOneOrFail(options: unknown) {
            state.voiceFindOneOrFailCalls.push(options);
            if (!state.voiceState) throw new Error("voice state not found");
            return state.voiceState;
        },
        merge(target: Record<string, unknown>, source: Record<string, unknown>) {
            Object.assign(target, source);
            return target;
        },
    },
    async emitEvent(payload: unknown) {
        state.emittedEvents.push(payload);
    },
    async getPermission(userId: string, guildId: string | undefined, channelId: string) {
        return {
            cache: {
                channel: state.channels[channelId],
                guild: guildId ? { id: guildId, owner_id: "owner" } : undefined,
            },
            hasThrow(permission: unknown) {
                state.permissionCalls.push({ channelId, guildId, permission, userId });
                if (state.permissionError) throw state.permissionError;
                if (!state.channels[channelId]) throw new Error("channel not found");
                return true;
            },
        };
    },
};

const mockGateway = {
    WebSocket: class {},
    generateStreamKey(type: "guild" | "call", guildId: string | undefined, channelId: string, userId: string) {
        return `${type}${type === "guild" ? `:${guildId}` : ""}:${channelId}:${userId}`;
    },
    genVoiceToken() {
        const token = `token-${state.generatedTokens.length + 1}`;
        state.generatedTokens.push(token);
        return token;
    },
    parseStreamKey(streamKey: string) {
        const parts = streamKey.split(":");
        const type = parts.shift();
        if (type === "guild") {
            const [guildId, channelId, userId] = parts;
            if (!guildId || !channelId || !userId) throw new Error("invalid stream key");
            return { channelId, guildId, type, userId };
        }
        if (type === "call") {
            const [channelId, userId] = parts;
            if (!channelId || !userId) throw new Error("invalid stream key");
            return { channelId, type, userId };
        }
        throw new Error("invalid stream key");
    },
};

moduleLoader._load = (request: string, parent?: NodeJS.Module | null, isMain?: boolean) => {
    if (request === "@spacebar/util") return mockUtil;
    if (request === "@spacebar/gateway") return mockGateway;
    if (request === "@spacebar/schemas") {
        return {
            ChannelType,
            StreamCreateSchema: {},
            StreamWatchSchema: {},
            VoiceStateUpdateSchema: {},
        };
    }
    if (request === "./instanceOf" && parent?.filename?.includes("/gateway/opcodes/")) return { check: () => true };

    return originalLoad(request, parent, isMain);
};

const { onVoiceStateUpdate } = require("./VoiceStateUpdate") as {
    onVoiceStateUpdate(this: MockSocket, payload: { d: unknown }): Promise<void>;
};
const { onStreamCreate } = require("./StreamCreate") as {
    onStreamCreate(this: MockSocket, payload: { d: unknown }): Promise<void>;
};
const { onStreamWatch } = require("./StreamWatch") as {
    onStreamWatch(this: MockSocket, payload: { d: unknown }): Promise<void>;
};

after(() => {
    moduleLoader._load = originalLoad;
});

beforeEach(() => {
    state.channels = { voice: defaultChannel() };
    state.emittedEvents = [];
    state.generatedTokens = [];
    state.memberFindOneCalls = [];
    state.memberFindOneResult = undefined;
    state.permissionError = undefined;
    state.permissionCalls = [];
    state.streamDeleteCalls = [];
    state.streamFindCalls = [];
    state.streamSaves = [];
    state.streamSessionSaves = [];
    state.voiceCreateCalls = [];
    state.voiceFindOneCalls = [];
    state.voiceFindOneOrFailCalls = [];
    state.voiceSaves = [];
    state.voiceState = undefined;
});

describe("gateway opcode authorization", () => {
    test("VOICE_STATE_UPDATE checks CONNECT before creating voice state or issuing a token", async () => {
        state.permissionError = new Error("missing CONNECT");

        await assert.rejects(
            onVoiceStateUpdate.call(makeSocket(), {
                d: {
                    channel_id: "voice",
                    guild_id: "guild",
                    self_deaf: false,
                    self_mute: false,
                },
            }),
            /missing CONNECT/,
        );

        assert.deepEqual(state.permissionCalls, [{ channelId: "voice", guildId: "guild", permission: "CONNECT", userId: "viewer" }]);
        assert.equal(state.voiceFindOneOrFailCalls.length, 0);
        assert.equal(state.voiceCreateCalls.length, 0);
        assert.equal(state.voiceSaves.length, 0);
        assert.equal(state.generatedTokens.length, 0);
        assert.deepEqual(state.emittedEvents, []);
    });

    test("VOICE_STATE_UPDATE does not create a tokenized voice state without a concrete channel", async () => {
        await onVoiceStateUpdate.call(makeSocket(), {
            d: {
                guild_id: "guild",
                self_deaf: false,
                self_mute: false,
            },
        });

        assert.deepEqual(state.permissionCalls, []);
        assert.equal(state.voiceFindOneOrFailCalls.length, 1);
        assert.equal(state.voiceCreateCalls.length, 0);
        assert.equal(state.voiceSaves.length, 0);
        assert.equal(state.generatedTokens.length, 0);
        assert.deepEqual(state.emittedEvents, []);
    });

    test("VOICE_STATE_UPDATE ignores channel-less updates from a different gateway session", async () => {
        state.voiceState = makeVoiceState({ channel_id: "voice", guild_id: "guild", session_id: "other-session", user_id: "viewer" });

        await onVoiceStateUpdate.call(makeSocket(), {
            d: {
                guild_id: "guild",
                self_deaf: false,
                self_mute: true,
            },
        });

        assert.deepEqual(state.permissionCalls, []);
        assert.equal(state.voiceFindOneOrFailCalls.length, 1);
        assert.equal(state.voiceCreateCalls.length, 0);
        assert.equal(state.voiceSaves.length, 0);
        assert.equal(state.generatedTokens.length, 0);
        assert.deepEqual(state.emittedEvents, []);
    });

    test("VOICE_STATE_UPDATE rejects mismatched caller guild and channel before side effects", async () => {
        await assert.rejects(
            onVoiceStateUpdate.call(makeSocket(), {
                d: {
                    channel_id: "voice",
                    guild_id: "other-guild",
                    self_deaf: false,
                    self_mute: false,
                },
            }),
            /channel_id does not belong to guild_id/,
        );

        assert.deepEqual(state.permissionCalls, [{ channelId: "voice", guildId: "other-guild", permission: "CONNECT", userId: "viewer" }]);
        assert.equal(state.voiceFindOneOrFailCalls.length, 0);
        assert.equal(state.voiceCreateCalls.length, 0);
        assert.equal(state.voiceSaves.length, 0);
        assert.equal(state.generatedTokens.length, 0);
        assert.deepEqual(state.emittedEvents, []);
    });

    test("VOICE_STATE_UPDATE loads and emits guild member when available", async () => {
        const publicMember = { roles: ["role"], user: { id: "viewer" } };
        state.memberFindOneResult = {
            toPublicMember() {
                return publicMember;
            },
        };

        await onVoiceStateUpdate.call(makeSocket(), {
            d: {
                channel_id: "voice",
                guild_id: "guild",
                self_deaf: false,
                self_mute: false,
            },
        });

        assert.deepEqual(state.memberFindOneCalls, [
            {
                where: { id: "viewer", guild_id: "guild" },
                relations: { user: true, roles: true },
            },
        ]);
        assert.equal(state.voiceSaves.length, 1);
        assert.equal(state.emittedEvents.length, 2);
        assert.deepEqual(state.emittedEvents[0], {
            event: "VOICE_STATE_UPDATE",
            data: {
                channel_id: "voice",
                guild_id: "guild",
                member: publicMember,
                session_id: "session",
                user_id: "viewer",
            },
            guild_id: "guild",
            channel_id: "voice",
            user_id: "viewer",
        });
    });

    test("VOICE_STATE_UPDATE continues without member when guild member lookup misses", async () => {
        state.memberFindOneResult = null;

        await onVoiceStateUpdate.call(makeSocket(), {
            d: {
                channel_id: "voice",
                guild_id: "guild",
                self_deaf: false,
                self_mute: false,
            },
        });

        assert.deepEqual(state.memberFindOneCalls, [
            {
                where: { id: "viewer", guild_id: "guild" },
                relations: { user: true, roles: true },
            },
        ]);
        assert.equal(state.voiceSaves.length, 1);
        assert.equal(state.emittedEvents.length, 2);
        assert.deepEqual(state.emittedEvents[0], {
            event: "VOICE_STATE_UPDATE",
            data: {
                channel_id: "voice",
                guild_id: "guild",
                member: undefined,
                session_id: "session",
                user_id: "viewer",
            },
            guild_id: "guild",
            channel_id: "voice",
            user_id: "viewer",
        });
    });

    test("STREAM_CREATE checks STREAM and current voice channel before creating stream state", async () => {
        state.voiceState = makeVoiceState({ channel_id: "other-voice", guild_id: "guild", session_id: "session", user_id: "viewer" });

        const socket = makeSocket();
        await onStreamCreate.call(socket, {
            d: {
                channel_id: "voice",
                guild_id: "guild",
                preferred_region: "local",
                type: "guild",
            },
        });

        assert.deepEqual(state.permissionCalls, [{ channelId: "voice", guildId: "guild", permission: ["CONNECT", "STREAM"], userId: "viewer" }]);
        assert.deepEqual(socket.closed, { code: 4000, reason: "invalid channel" });
        assert.equal(state.streamDeleteCalls.length, 0);
        assert.equal(state.streamSaves.length, 0);
        assert.equal(state.streamSessionSaves.length, 0);
        assert.equal(state.generatedTokens.length, 0);
        assert.deepEqual(state.emittedEvents, []);
    });

    test("STREAM_CREATE ignores voice states from a different gateway session", async () => {
        state.voiceState = makeVoiceState({ channel_id: "voice", guild_id: "guild", session_id: "other-session", user_id: "viewer" });

        await onStreamCreate.call(makeSocket(), {
            d: {
                channel_id: "voice",
                guild_id: "guild",
                preferred_region: "local",
                type: "guild",
            },
        });

        assert.deepEqual(state.permissionCalls, []);
        assert.equal(state.streamDeleteCalls.length, 0);
        assert.equal(state.streamSaves.length, 0);
        assert.equal(state.streamSessionSaves.length, 0);
        assert.equal(state.generatedTokens.length, 0);
        assert.deepEqual(state.emittedEvents, []);
    });

    test("STREAM_CREATE rejects unauthorized channels before creating stream sessions", async () => {
        state.permissionError = new Error("missing STREAM");
        state.voiceState = makeVoiceState({ channel_id: "voice", guild_id: "guild", session_id: "session", user_id: "viewer" });

        await assert.rejects(
            onStreamCreate.call(makeSocket(), {
                d: {
                    channel_id: "voice",
                    guild_id: "guild",
                    preferred_region: "local",
                    type: "guild",
                },
            }),
            /missing STREAM/,
        );

        assert.deepEqual(state.permissionCalls, [{ channelId: "voice", guildId: "guild", permission: ["CONNECT", "STREAM"], userId: "viewer" }]);
        assert.equal(state.streamDeleteCalls.length, 0);
        assert.equal(state.streamSaves.length, 0);
        assert.equal(state.streamSessionSaves.length, 0);
        assert.equal(state.generatedTokens.length, 0);
        assert.deepEqual(state.emittedEvents, []);
    });

    test("STREAM_WATCH checks CONNECT before resolving stream and issuing a session token", async () => {
        state.permissionError = new Error("missing CONNECT");
        const socket = makeSocket();

        await onStreamWatch.call(socket, { d: { stream_key: "guild:guild:voice:owner" } });

        assert.deepEqual(state.permissionCalls, [{ channelId: "voice", guildId: "guild", permission: "CONNECT", userId: "viewer" }]);
        assert.deepEqual(socket.closed, { code: 4000, reason: "Invalid stream key" });
        assert.equal(state.streamFindCalls.length, 0);
        assert.equal(state.streamSessionSaves.length, 0);
        assert.equal(state.generatedTokens.length, 0);
        assert.deepEqual(state.emittedEvents, []);
    });

    test("STREAM_WATCH rejects mismatched stream key guild and channel before stream lookup", async () => {
        const socket = makeSocket();

        await onStreamWatch.call(socket, { d: { stream_key: "guild:other-guild:voice:owner" } });

        assert.deepEqual(state.permissionCalls, [{ channelId: "voice", guildId: "other-guild", permission: "CONNECT", userId: "viewer" }]);
        assert.deepEqual(socket.closed, { code: 4000, reason: "Invalid stream key" });
        assert.equal(state.streamFindCalls.length, 0);
        assert.equal(state.streamSessionSaves.length, 0);
        assert.equal(state.generatedTokens.length, 0);
        assert.deepEqual(state.emittedEvents, []);
    });
});
