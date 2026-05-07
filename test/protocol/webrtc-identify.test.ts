import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CLOSECODES } from "@spacebar/gateway";
import { closeDatabase, initDatabase, Snowflake, User, VoiceState } from "@spacebar/util";
import { mediaServer, setMediaServerForTesting, VoiceOPCodes } from "@spacebar/webrtc";
import { ChannelType } from "@spacebar/schemas";
import type { Codec, SignalingDelegate, SSRCs, VideoStream, WebRtcClient } from "@spacebarchat/spacebar-webrtc-types";
import ws from "ws";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { makeChannel, makeGuild } from "../fixtures/entities";
import { startWebRtc } from "../server/startWebRtc";

const coveredManifestIds = ["webrtc:opcode:IDENTIFY", "webrtc:opcode:SELECT_PROTOCOL"];
type VoicePayload = { op: number; d?: unknown };

test(
    "WebRTC IDENTIFY accepts a persisted voice state and SELECT_PROTOCOL returns a fake SDP answer",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, ["webrtc:opcode:IDENTIFY", "webrtc:opcode:SELECT_PROTOCOL"]);

        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_webrtc_identify" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-webrtc-identify-"));
        const previous = snapshotProcessState();
        const previousMediaServer = mediaServer;
        const fakeMediaServer = new FakeSignalingDelegate();
        let server: Awaited<ReturnType<typeof startWebRtc>> | undefined;
        let client: ws | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;

            setMediaServerForTesting(fakeMediaServer);
            await initDatabase();

            const { user, guild, channel, token, sessionId } = await createVoiceStateFixture();
            server = await startWebRtc();
            client = new ws(`${server.url}/?v=5`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readJsonMessage(client);
            assert.equal(hello.op, VoiceOPCodes.HELLO);

            client.send(
                JSON.stringify({
                    op: VoiceOPCodes.IDENTIFY,
                    d: {
                        server_id: guild.id,
                        user_id: user.id,
                        session_id: sessionId,
                        token,
                        video: true,
                        streams: [{ type: "video", rid: "100", quality: 100 }],
                    },
                }),
            );

            const ready = await readJsonMessage(client);
            assert.equal(ready.op, VoiceOPCodes.READY);
            const readyData = assertPayloadRecord(ready.d);
            assert.equal(readyData.ip, fakeMediaServer.ip);
            assert.equal(readyData.port, fakeMediaServer.port);
            assert.equal(typeof readyData.ssrc, "number");
            assert.deepEqual(fakeMediaServer.joinCalls, [{ roomId: channel.id, userId: user.id, type: "guild-voice" }]);

            client.send(
                JSON.stringify({
                    op: VoiceOPCodes.SELECT_PROTOCOL,
                    d: {
                        protocol: "webrtc",
                        data: "",
                        sdp: "fake-offer-sdp",
                        codecs: [{ name: "VP8", type: "video", priority: 1, payload_type: 96 }],
                    },
                }),
            );

            const sessionDescription = await readJsonMessage(client);
            assert.equal(sessionDescription.op, VoiceOPCodes.SESSION_DESCRIPTION);
            const sessionDescriptionData = assertPayloadRecord(sessionDescription.d);
            assert.equal(sessionDescriptionData.sdp, fakeMediaServer.answerSdp);
            assert.equal(sessionDescriptionData.video_codec, fakeMediaServer.selectedVideoCodec);
            assert.equal(sessionDescriptionData.audio_codec, "opus");
            assert.equal(sessionDescriptionData.media_session_id, sessionId);
            assert.deepEqual(fakeMediaServer.offers, [{ offer: "fake-offer-sdp", codecs: [{ name: "VP8", type: "video", priority: 1, payload_type: 96 }] }]);

            await closeClient(client);
            await waitForCloseHandlers();
            client = undefined;
            assert.equal(fakeMediaServer.getClientsForRtcServer(channel.id).size, 0);
        } finally {
            if (client) await closeClient(client);
            if (server) await server.stop();
            setMediaServerForTesting(previousMediaServer);
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

test(
    "WebRTC IDENTIFY closes unmatched voice tokens with authentication failure",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_webrtc_identify_invalid" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-webrtc-identify-invalid-"));
        const previous = snapshotProcessState();
        const previousMediaServer = mediaServer;
        const fakeMediaServer = new FakeSignalingDelegate();
        let server: Awaited<ReturnType<typeof startWebRtc>> | undefined;
        let client: ws | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;

            setMediaServerForTesting(fakeMediaServer);
            await initDatabase();

            server = await startWebRtc();
            client = new ws(`${server.url}/?v=5`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readJsonMessage(client);
            assert.equal(hello.op, VoiceOPCodes.HELLO);

            client.send(
                JSON.stringify({
                    op: VoiceOPCodes.IDENTIFY,
                    d: {
                        server_id: Snowflake.generate(),
                        user_id: Snowflake.generate(),
                        session_id: "missing-voice-session",
                        token: "missing-voice-token",
                    },
                }),
            );

            const close = await readClose(client);
            assert.equal(close.code, CLOSECODES.Authentication_failed);
            assert.deepEqual(fakeMediaServer.joinCalls, []);
        } finally {
            if (client) await closeClient(client);
            if (server) await server.stop();
            setMediaServerForTesting(previousMediaServer);
            await closeDatabase();
            await database.close();
            restoreProcessState(previous);
            await rm(tempCwd, { recursive: true, force: true });
        }
    },
);

async function createVoiceStateFixture() {
    const suffix = `${process.pid}${Date.now()}`;
    const user = await User.register({
        username: `webrtc${suffix.slice(-8)}`,
        email: `webrtc-${suffix}@example.com`,
        password: "webrtc-password-fixture",
    });
    const guild = await makeGuild(user, { id: Snowflake.generate(), name: "WebRTC Fixture Guild" }).save();
    const channel = await makeChannel(guild, {
        id: Snowflake.generate(),
        name: "voice",
        type: ChannelType.GUILD_VOICE,
    }).save();
    const sessionId = "voice-session-fixture";
    const token = "voice-token-fixture";

    await VoiceState.create({
        guild_id: guild.id,
        channel_id: channel.id,
        user_id: user.id,
        session_id: sessionId,
        token,
        deaf: false,
        mute: false,
        self_deaf: false,
        self_mute: false,
        self_video: false,
        suppress: false,
    }).save();

    return { user, guild, channel, sessionId, token };
}

function assertPayloadRecord(value: unknown) {
    assert.equal(typeof value, "object");
    assert.notEqual(value, null);
    return value as Record<string, unknown>;
}

class FakeWebRtcClient<T> implements WebRtcClient<T> {
    websocket: T;
    user_id: string;
    voiceRoomId: string;
    webrtcConnected = true;
    emitter = new EventEmitter() as WebRtcClient<T>["emitter"];
    videoStream?: VideoStream;

    private incomingSsrcs: SSRCs = {};
    private producing = new Set<"audio" | "video">();
    private subscriptions = new Map<string, Set<"audio" | "video">>();

    constructor(voiceRoomId: string, userId: string, websocket: T) {
        this.voiceRoomId = voiceRoomId;
        this.user_id = userId;
        this.websocket = websocket;
        setImmediate(() => this.emitter.emit("connected"));
    }

    initIncomingSSRCs(ssrcs: SSRCs) {
        this.incomingSsrcs = ssrcs;
    }

    getIncomingStreamSSRCs() {
        return this.incomingSsrcs;
    }

    getOutgoingStreamSSRCsForUser() {
        return this.incomingSsrcs;
    }

    isProducingAudio() {
        return this.producing.has("audio");
    }

    isProducingVideo() {
        return this.producing.has("video");
    }

    async publishTrack(type: "audio" | "video") {
        this.producing.add(type);
    }

    stopPublishingTrack(type: "audio" | "video") {
        this.producing.delete(type);
    }

    async subscribeToTrack(userId: string, type: "audio" | "video") {
        const subscriptions = this.subscriptions.get(userId) ?? new Set<"audio" | "video">();
        subscriptions.add(type);
        this.subscriptions.set(userId, subscriptions);
    }

    unSubscribeFromTrack(userId: string, type: "audio" | "video") {
        this.subscriptions.get(userId)?.delete(type);
    }

    isSubscribedToTrack(userId: string, type: "audio" | "video") {
        return this.subscriptions.get(userId)?.has(type) ?? false;
    }
}

type JoinCall = { roomId: string; userId: string; type: "guild-voice" | "dm-voice" | "stream" };
type OfferCall = { offer: string; codecs: Codec[] };

class FakeSignalingDelegate implements SignalingDelegate {
    answerSdp = "fake-answer-sdp";
    selectedVideoCodec = "VP8";
    joinCalls: JoinCall[] = [];
    offers: OfferCall[] = [];

    private clients = new Map<string, Set<WebRtcClient<unknown>>>();

    get ip() {
        return "127.0.0.1";
    }

    get port() {
        return 20_000;
    }

    async start() {}

    async stop() {
        this.clients.clear();
    }

    async join<T>(roomId: string, userId: string, websocket: T, type: "guild-voice" | "dm-voice" | "stream") {
        this.joinCalls.push({ roomId, userId, type });
        const client = new FakeWebRtcClient(roomId, userId, websocket);
        this.clientsFor(roomId).add(client as WebRtcClient<unknown>);
        return client;
    }

    async onOffer<T>(_client: WebRtcClient<T>, offer: string, codecs: Codec[]) {
        this.offers.push({ offer, codecs });
        return { sdp: this.answerSdp, selectedVideoCodec: this.selectedVideoCodec };
    }

    onClientClose<T>(client: WebRtcClient<T>) {
        this.clientsFor(client.voiceRoomId).delete(client as WebRtcClient<unknown>);
    }

    updateSDP() {}

    getClientsForRtcServer<T>(rtcServerId: string) {
        return this.clientsFor(rtcServerId) as unknown as Set<WebRtcClient<T>>;
    }

    private clientsFor(rtcServerId: string) {
        let clients = this.clients.get(rtcServerId);
        if (!clients) {
            clients = new Set<WebRtcClient<unknown>>();
            this.clients.set(rtcServerId, clients);
        }
        return clients;
    }
}

async function readJsonMessage(client: ws) {
    const raw = await new Promise<ws.RawData>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for WebRTC message"));
        }, 10_000);
        const cleanup = () => {
            clearTimeout(timeout);
            client.off("message", onMessage);
            client.off("error", onError);
            client.off("close", onClose);
        };
        const onMessage = (message: ws.RawData) => {
            cleanup();
            resolve(message);
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        const onClose = (code: number) => {
            cleanup();
            reject(new Error(`WebRTC closed before message: ${code}`));
        };
        client.once("message", onMessage);
        client.once("error", onError);
        client.once("close", onClose);
    });

    return JSON.parse(raw.toString()) as VoicePayload;
}

async function readClose(client: ws) {
    return await new Promise<{ code: number; reason: Buffer }>((resolve, reject) => {
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Timed out waiting for WebRTC close"));
        }, 10_000);
        const cleanup = () => {
            clearTimeout(timeout);
            client.off("close", onClose);
            client.off("error", onError);
        };
        const onClose = (code: number, reason: Buffer) => {
            cleanup();
            resolve({ code, reason });
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        client.once("close", onClose);
        client.once("error", onError);
    });
}

async function closeClient(client: ws) {
    if (client.readyState === ws.CLOSED) return;
    await new Promise<void>((resolve) => {
        client.once("close", () => resolve());
        if (client.readyState === ws.OPEN || client.readyState === ws.CONNECTING) client.close();
        else resolve();
    });
}

async function waitForCloseHandlers() {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
    });
}

function snapshotProcessState() {
    return {
        cwd: process.cwd(),
        DATABASE: process.env.DATABASE,
        APPLY_DB_MIGRATIONS: process.env.APPLY_DB_MIGRATIONS,
        CONFIG_PATH: process.env.CONFIG_PATH,
        DB_SYNC: process.env.DB_SYNC,
    };
}

function restoreProcessState(state: ReturnType<typeof snapshotProcessState>) {
    process.chdir(state.cwd);
    restoreEnv("DATABASE", state.DATABASE);
    restoreEnv("APPLY_DB_MIGRATIONS", state.APPLY_DB_MIGRATIONS);
    restoreEnv("CONFIG_PATH", state.CONFIG_PATH);
    restoreEnv("DB_SYNC", state.DB_SYNC);
}

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
