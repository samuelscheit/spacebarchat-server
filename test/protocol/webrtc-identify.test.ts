import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CLOSECODES } from "@spacebar/gateway";
import { closeDatabase, initDatabase, Snowflake, type Channel, type Guild, User, VoiceState } from "@spacebar/util";
import { mediaServer, setMediaServerForTesting, VoiceOPCodes } from "@spacebar/webrtc";
import { ChannelType } from "@spacebar/schemas";
import type { Codec, SignalingDelegate, SSRCs, VideoStream, WebRtcClient } from "@spacebarchat/spacebar-webrtc-types";
import ws from "ws";
import { createDisposablePostgresDatabase, hasPostgresAdminUrl } from "../fixtures/database";
import { makeChannel, makeGuild } from "../fixtures/entities";
import { startWebRtc } from "../server/startWebRtc";

const coveredManifestIds = ["webrtc:opcode:IDENTIFY", "webrtc:opcode:SELECT_PROTOCOL", "webrtc:opcode:SPEAKING", "webrtc:opcode:VIDEO"];
type VoicePayload = { op: number; d?: unknown };

test(
    "WebRTC IDENTIFY accepts a persisted voice state and SELECT_PROTOCOL returns a fake SDP answer",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        assert.deepEqual(coveredManifestIds, ["webrtc:opcode:IDENTIFY", "webrtc:opcode:SELECT_PROTOCOL", "webrtc:opcode:SPEAKING", "webrtc:opcode:VIDEO"]);

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

test(
    "WebRTC VIDEO publishes media updates and SPEAKING fans out to room peers",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_webrtc_media" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-webrtc-media-"));
        const previous = snapshotProcessState();
        const previousMediaServer = mediaServer;
        const fakeMediaServer = new FakeSignalingDelegate();
        const clients: ws[] = [];
        let server: Awaited<ReturnType<typeof startWebRtc>> | undefined;

        try {
            process.chdir(tempCwd);
            process.env.DATABASE = database.url;
            process.env.APPLY_DB_MIGRATIONS = "true";
            delete process.env.CONFIG_PATH;
            delete process.env.DB_SYNC;

            setMediaServerForTesting(fakeMediaServer);
            await initDatabase();

            const speaker = await createVoiceStateFixture({ usernamePrefix: "speaker" });
            const listener = await createVoiceStateFixture({ guild: speaker.guild, channel: speaker.channel, usernamePrefix: "listener" });
            server = await startWebRtc();

            const speakerConnection = await connectIdentifiedClient(server.url, speaker);
            clients.push(speakerConnection.client);
            const listenerConnection = await connectIdentifiedClient(server.url, listener);
            clients.push(listenerConnection.client);

            speakerConnection.client.send(
                JSON.stringify({
                    op: VoiceOPCodes.VIDEO,
                    d: {
                        audio_ssrc: 1111,
                        video_ssrc: 2222,
                        rtx_ssrc: 3333,
                        streams: [{ type: "video", rid: "100", active: true, quality: 100 }],
                    },
                }),
            );

            const mediaSinkWants = await readJsonMessage(speakerConnection.client);
            assert.equal(mediaSinkWants.op, VoiceOPCodes.MEDIA_SINK_WANTS);
            assert.deepEqual(mediaSinkWants.d, { any: 100 });

            const video = await readJsonMessage(listenerConnection.client);
            assert.equal(video.op, VoiceOPCodes.VIDEO);
            const videoData = assertPayloadRecord(video.d);
            assert.equal(videoData.user_id, speaker.user.id);
            assert.equal(videoData.audio_ssrc, 1111);
            assert.equal(videoData.video_ssrc, 2222);
            assert.equal(videoData.rtx_ssrc, 3333);
            const streams = assertPayloadArray(videoData.streams);
            const stream = assertPayloadRecord(streams[0]);
            assert.equal(stream.type, "video");
            assert.equal(stream.ssrc, 2222);
            assert.equal(stream.rtx_ssrc, 3333);

            speakerConnection.client.send(
                JSON.stringify({
                    op: VoiceOPCodes.SPEAKING,
                    d: {
                        speaking: 1,
                        delay: 0,
                        ssrc: 1111,
                    },
                }),
            );

            const speaking = await readJsonMessage(listenerConnection.client);
            assert.equal(speaking.op, VoiceOPCodes.SPEAKING);
            const speakingData = assertPayloadRecord(speaking.d);
            assert.equal(speakingData.user_id, speaker.user.id);
            assert.equal(speakingData.speaking, 1);
            assert.equal(speakingData.ssrc, 1111);

            await Promise.all(clients.map((client) => closeClient(client)));
            await waitForCloseHandlers();
            clients.length = 0;
            assert.equal(fakeMediaServer.getClientsForRtcServer(speaker.channel.id).size, 0);
        } finally {
            await Promise.all(clients.map((client) => closeClient(client)));
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
    "WebRTC SELECT_PROTOCOL closes when the media server cannot answer an offer",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_webrtc_offer_failure" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-webrtc-offer-failure-"));
        const previous = snapshotProcessState();
        const previousMediaServer = mediaServer;
        const fakeMediaServer = new FakeSignalingDelegate();
        fakeMediaServer.failOffers = true;
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

            const fixture = await createVoiceStateFixture({ usernamePrefix: "offerfail" });
            server = await startWebRtc();
            const connection = await connectIdentifiedClient(server.url, fixture);
            client = connection.client;

            client.send(
                JSON.stringify({
                    op: VoiceOPCodes.SELECT_PROTOCOL,
                    d: {
                        protocol: "webrtc",
                        data: "",
                        sdp: "failing-offer-sdp",
                        codecs: [],
                    },
                }),
            );

            const close = await readClose(client);
            assert.equal(close.code, CLOSECODES.Unknown_error);
            assert.deepEqual(fakeMediaServer.offers, [{ offer: "failing-offer-sdp", codecs: [] }]);
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
    "WebRTC IDENTIFY closes when the media server cannot join a valid voice state",
    {
        skip: !hasPostgresAdminUrl(),
        timeout: 180_000,
    },
    async () => {
        const database = await createDisposablePostgresDatabase({ prefix: "spacebar_webrtc_join_failure" });
        const tempCwd = await mkdtemp(path.join(tmpdir(), "spacebar-webrtc-join-failure-"));
        const previous = snapshotProcessState();
        const previousMediaServer = mediaServer;
        const fakeMediaServer = new FakeSignalingDelegate();
        fakeMediaServer.failJoins = true;
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

            const fixture = await createVoiceStateFixture({ usernamePrefix: "joinfail" });
            server = await startWebRtc();
            client = new ws(`${server.url}/?v=5`, { headers: { "User-Agent": "spacebar-test" } });
            const hello = await readJsonMessage(client);
            assert.equal(hello.op, VoiceOPCodes.HELLO);

            client.send(
                JSON.stringify({
                    op: VoiceOPCodes.IDENTIFY,
                    d: {
                        server_id: fixture.guild.id,
                        user_id: fixture.user.id,
                        session_id: fixture.sessionId,
                        token: fixture.token,
                    },
                }),
            );

            const close = await readClose(client);
            assert.equal(close.code, CLOSECODES.Unknown_error);
            assert.deepEqual(fakeMediaServer.joinCalls, [{ roomId: fixture.channel.id, userId: fixture.user.id, type: "guild-voice" }]);
            assert.equal(fakeMediaServer.getClientsForRtcServer(fixture.channel.id).size, 0);
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

interface VoiceStateFixture {
    user: User;
    guild: Guild;
    channel: Channel;
    sessionId: string;
    token: string;
}

interface VoiceStateFixtureOptions {
    guild?: Guild;
    channel?: Channel;
    usernamePrefix?: string;
}

async function createVoiceStateFixture(options: VoiceStateFixtureOptions = {}): Promise<VoiceStateFixture> {
    const suffix = `${process.pid}${Date.now()}`;
    const usernamePrefix = options.usernamePrefix ?? "webrtc";
    const user = await User.register({
        username: `${usernamePrefix}${suffix.slice(-8)}`,
        email: `${usernamePrefix}-${suffix}-${Snowflake.generate()}@example.com`,
        password: "webrtc-password-fixture",
    });
    const guild = options.guild ?? (await makeGuild(user, { id: Snowflake.generate(), name: "WebRTC Fixture Guild" }).save());
    const channel =
        options.channel ??
        (await makeChannel(guild, {
            id: Snowflake.generate(),
            name: "voice",
            type: ChannelType.GUILD_VOICE,
        }).save());
    const id = Snowflake.generate();
    const sessionId = `voice-session-${id}`;
    const token = `voice-token-${id}`;

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

async function connectIdentifiedClient(serverUrl: string, fixture: VoiceStateFixture) {
    const client = new ws(`${serverUrl}/?v=5`, { headers: { "User-Agent": "spacebar-test" } });
    const hello = await readJsonMessage(client);
    assert.equal(hello.op, VoiceOPCodes.HELLO);

    client.send(
        JSON.stringify({
            op: VoiceOPCodes.IDENTIFY,
            d: {
                server_id: fixture.guild.id,
                user_id: fixture.user.id,
                session_id: fixture.sessionId,
                token: fixture.token,
                video: true,
                streams: [{ type: "video", rid: "100", quality: 100 }],
            },
        }),
    );

    const ready = await readJsonMessage(client);
    assert.equal(ready.op, VoiceOPCodes.READY);
    return { client, readyData: assertPayloadRecord(ready.d) };
}

function assertPayloadRecord(value: unknown) {
    assert.equal(typeof value, "object");
    assert.notEqual(value, null);
    return value as Record<string, unknown>;
}

function assertPayloadArray(value: unknown) {
    assert.equal(Array.isArray(value), true);
    return value as unknown[];
}

class FakeWebRtcClient<T> implements WebRtcClient<T> {
    websocket: T;
    user_id: string;
    voiceRoomId: string;
    webrtcConnected = true;
    emitter = new EventEmitter() as WebRtcClient<T>["emitter"];
    videoStream?: VideoStream;

    private incomingSsrcs: SSRCs = {};
    private publishedSsrcs: SSRCs = {};
    private outgoingSsrcsByUser = new Map<string, SSRCs>();
    private producing = new Set<"audio" | "video">();
    private subscriptions = new Map<string, Set<"audio" | "video">>();

    constructor(
        voiceRoomId: string,
        userId: string,
        websocket: T,
        private readonly getPeerSsrcs: (userId: string) => SSRCs,
    ) {
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

    getPublishedStreamSSRCs() {
        return this.publishedSsrcs;
    }

    getOutgoingStreamSSRCsForUser(userId: string) {
        return this.outgoingSsrcsByUser.get(userId) ?? {};
    }

    isProducingAudio() {
        return this.producing.has("audio");
    }

    isProducingVideo() {
        return this.producing.has("video");
    }

    async publishTrack(type: "audio" | "video", ssrc: SSRCs) {
        this.producing.add(type);
        this.publishedSsrcs = { ...this.publishedSsrcs, ...ssrc };
    }

    stopPublishingTrack(type: "audio" | "video") {
        this.producing.delete(type);
        if (type === "audio") delete this.publishedSsrcs.audio_ssrc;
        else {
            delete this.publishedSsrcs.video_ssrc;
            delete this.publishedSsrcs.rtx_ssrc;
        }
    }

    async subscribeToTrack(userId: string, type: "audio" | "video") {
        const subscriptions = this.subscriptions.get(userId) ?? new Set<"audio" | "video">();
        subscriptions.add(type);
        this.subscriptions.set(userId, subscriptions);
        this.outgoingSsrcsByUser.set(userId, this.getPeerSsrcs(userId));
    }

    unSubscribeFromTrack(userId: string, type: "audio" | "video") {
        this.subscriptions.get(userId)?.delete(type);
        if (!this.subscriptions.get(userId)?.size) this.outgoingSsrcsByUser.delete(userId);
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
    failJoins = false;
    failOffers = false;
    joinCalls: JoinCall[] = [];
    offers: OfferCall[] = [];

    private clients = new Map<string, Set<FakeWebRtcClient<unknown>>>();

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
        if (this.failJoins) throw new Error("fake media server failed to join client");
        const client = new FakeWebRtcClient(roomId, userId, websocket, (peerUserId) => this.getPublishedSsrcsForUser(roomId, peerUserId));
        this.clientsFor(roomId).add(client as FakeWebRtcClient<unknown>);
        return client;
    }

    async onOffer<T>(_client: WebRtcClient<T>, offer: string, codecs: Codec[]) {
        this.offers.push({ offer, codecs });
        if (this.failOffers) throw new Error("fake media server failed to answer offer");
        return { sdp: this.answerSdp, selectedVideoCodec: this.selectedVideoCodec };
    }

    onClientClose<T>(client: WebRtcClient<T>) {
        this.clientsFor(client.voiceRoomId).delete(client as FakeWebRtcClient<unknown>);
    }

    updateSDP() {}

    getClientsForRtcServer<T>(rtcServerId: string) {
        return this.clientsFor(rtcServerId) as unknown as Set<WebRtcClient<T>>;
    }

    private clientsFor(rtcServerId: string) {
        let clients = this.clients.get(rtcServerId);
        if (!clients) {
            clients = new Set<FakeWebRtcClient<unknown>>();
            this.clients.set(rtcServerId, clients);
        }
        return clients;
    }

    private getPublishedSsrcsForUser(roomId: string, userId: string) {
        for (const client of this.clientsFor(roomId)) {
            if (client.user_id === userId) return client.getPublishedStreamSSRCs();
        }

        return {};
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
