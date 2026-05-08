import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Session, VoiceState } from "@spacebar/util";

import { CLOSECODES, OPCODES, type Payload } from "./Constants";
import { cleanupOnStartup, handleOffloadedGatewayRequest } from "./Utils";
import type { WebSocket } from "./WebSocket";

async function waitFor(assertion: () => void, timeoutMs = 500) {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
        try {
            assertion();
            return;
        } catch (error) {
            lastError = error;
            await new Promise<void>((resolve) => {
                setImmediate(resolve);
            });
        }
    }

    if (lastError) throw lastError;
    assertion();
}

function createSocket(options: { close?: (code?: number, reason?: string) => void } = {}) {
    const sent: Payload[] = [];
    const socket = {
        accessToken: "access-token",
        session_id: "session-id",
        sequence: 42,
        encoding: "json",
        readyState: 1,
        OPEN: 1,
        send(data: string | Buffer, callback: (error?: Error) => void) {
            sent.push(JSON.parse(data.toString()) as Payload);
            callback();
        },
        close(code?: number, reason?: string) {
            if (options.close) {
                options.close(code, reason);
                return;
            }

            throw new Error("socket should remain open");
        },
    } as unknown as WebSocket;

    return { socket, sent };
}

describe("handleOffloadedGatewayRequest", () => {
    test("streams offloaded JSON array events before the response reaches EOF", async () => {
        const originalFetch = globalThis.fetch;
        const encoder = new TextEncoder();
        const { socket, sent } = createSocket();
        const observedEvents: string[] = [];
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const responseStream = new ReadableStream<Uint8Array>({
            start(value) {
                controller = value;
            },
        });
        let requestBody: string | undefined;
        let requestHeaders: RequestInit["headers"];

        try {
            globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
                requestBody = init?.body?.toString();
                requestHeaders = init?.headers;
                return new Response(responseStream, { status: 200, headers: { "content-type": "application/json" } });
            }) as typeof fetch;

            const offload = handleOffloadedGatewayRequest(socket, "http://offload.example/gateway", { guild_id: "guild" }, (event) => {
                observedEvents.push(event.event);
            });

            controller.enqueue(encoder.encode('[{"event":"FIRST_EVENT","data":{"id":1}}'));

            await waitFor(() =>
                assert.deepEqual(sent, [
                    {
                        op: OPCODES.Dispatch,
                        s: 42,
                        t: "FIRST_EVENT",
                        d: { id: 1 },
                    },
                ]),
            );
            assert.equal(socket.sequence, 43);
            assert.equal(requestBody, JSON.stringify({ guild_id: "guild" }));
            assert.deepEqual(requestHeaders, {
                Authorization: "Bearer access-token",
                "X-Session-Id": "session-id",
                "Content-Type": "application/json",
            });
            assert.deepEqual(observedEvents, ["FIRST_EVENT"]);

            controller.enqueue(encoder.encode(',{"event":"SECOND_EVENT","data":{"id":2}}]'));
            controller.close();
            await offload;

            assert.deepEqual(sent, [
                {
                    op: OPCODES.Dispatch,
                    s: 42,
                    t: "FIRST_EVENT",
                    d: { id: 1 },
                },
                {
                    op: OPCODES.Dispatch,
                    s: 43,
                    t: "SECOND_EVENT",
                    d: { id: 2 },
                },
            ]);
            assert.deepEqual(observedEvents, ["FIRST_EVENT", "SECOND_EVENT"]);
            assert.equal(socket.sequence, 44);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("closes the gateway socket for offloaded SB_GW_CLOSE responses", async () => {
        const originalFetch = globalThis.fetch;
        const closeCalls: Array<{ code?: number; reason?: string }> = [];
        const { socket, sent } = createSocket({
            close(code, reason) {
                closeCalls.push({ code, reason });
            },
        });
        let request: { url: string | URL | Request; init?: RequestInit } | undefined;

        try {
            globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
                request = { url, init };
                return new Response(
                    JSON.stringify([
                        {
                            event: "SB_GW_CLOSE",
                            data: { code: CLOSECODES.Invalid_shard, reason: "invalid shard" },
                        },
                    ]),
                    {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    },
                );
            }) as typeof fetch;

            await handleOffloadedGatewayRequest(socket, "http://offload.example/identify", { token: "token" });

            assert.deepEqual(closeCalls, [{ code: CLOSECODES.Invalid_shard, reason: "invalid shard" }]);
            assert.deepEqual(sent, []);
            assert.equal(socket.sequence, 42);
            assert.equal(request?.url, "http://offload.example/identify");
            assert.equal((request?.init?.headers as Record<string, string>)?.Authorization, "Bearer access-token");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("stops streaming and dispatching when an offloaded close event is received", async () => {
        const originalFetch = globalThis.fetch;
        const encoder = new TextEncoder();
        const closeCalls: Array<{ code?: number; reason?: string }> = [];
        const { socket, sent } = createSocket({
            close(code, reason) {
                closeCalls.push({ code, reason });
            },
        });
        let canceled = false;
        const responseStream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(
                    encoder.encode(
                        '[{"event":"FIRST_EVENT","data":{"id":1}},{"event":"SB_GW_CLOSE","data":{"code":4000,"reason":"stop"}},{"event":"SHOULD_NOT_SEND","data":{"id":2}}]',
                    ),
                );
            },
            cancel() {
                canceled = true;
            },
        });

        try {
            globalThis.fetch = (async () => new Response(responseStream, { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

            await handleOffloadedGatewayRequest(socket, "http://offload.example/gateway", {});

            assert.deepEqual(sent, [
                {
                    op: OPCODES.Dispatch,
                    s: 42,
                    t: "FIRST_EVENT",
                    d: { id: 1 },
                },
            ]);
            assert.deepEqual(closeCalls, [{ code: 4000, reason: "stop" }]);
            assert.equal(socket.sequence, 43);
            assert.equal(canceled, true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("uses Unknown_error when SB_GW_CLOSE omits a numeric close code", async () => {
        const originalFetch = globalThis.fetch;
        const closeCalls: Array<{ code?: number; reason?: string }> = [];
        const { socket } = createSocket({
            close(code, reason) {
                closeCalls.push({ code, reason });
            },
        });

        try {
            globalThis.fetch = (async () =>
                new Response(JSON.stringify([{ event: "SB_GW_CLOSE", data: { code: "4010" } }]), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                })) as typeof fetch;

            await handleOffloadedGatewayRequest(socket, "http://offload.example/identify", {});

            assert.deepEqual(closeCalls, [{ code: CLOSECODES.Unknown_error, reason: undefined }]);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("rejects successful offload responses that do not include a body", async () => {
        const originalFetch = globalThis.fetch;
        const { socket, sent } = createSocket();

        try {
            globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch;

            await assert.rejects(() => handleOffloadedGatewayRequest(socket, "http://offload.example/gateway", {}), /Offloaded request did not return a response body/);
            assert.deepEqual(sent, []);
            assert.equal(socket.sequence, 42);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("reports offload HTTP errors without attempting to parse the body", async () => {
        const originalFetch = globalThis.fetch;
        const { socket, sent } = createSocket();

        try {
            globalThis.fetch = (async () => new Response("unsupported", { status: 415 })) as typeof fetch;

            await assert.rejects(
                () => handleOffloadedGatewayRequest(socket, "http://offload.example/gateway", { ok: true }),
                /Offloaded request failed with status 415: unsupported/,
            );
            assert.deepEqual(sent, []);
            assert.equal(socket.sequence, 42);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

type StreamedSessionRow = {
    session_last_seen: Date;
    session_session_id: string;
};

function createSessionStreamQuery(rows: StreamedSessionRow[]) {
    return {
        where(condition: string) {
            assert.equal(condition, "last_seen >= '2000/01/01' AND status != 'offline'");
            return this;
        },
        select() {
            return this;
        },
        async *stream() {
            for (const row of rows) yield row;
        },
    };
}

describe("cleanupOnStartup", () => {
    test("expires old presences without wiping voice states", async (t) => {
        const staleSession = {
            session_last_seen: new Date(Date.now() - 31 * 60 * 1000),
            session_session_id: "stale-session",
        };
        const freshSession = {
            session_last_seen: new Date(),
            session_session_id: "fresh-session",
        };

        const voiceStateClear = t.mock.method(VoiceState, "clear", async () => {
            throw new Error("startup must not clear active voice states");
        });
        const createQueryBuilder = t.mock.method(Session, "createQueryBuilder", () => createSessionStreamQuery([staleSession, freshSession]));
        const updateSession = t.mock.method(Session, "update", async () => ({ affected: 1, generatedMaps: [], raw: [] }));

        await cleanupOnStartup();

        assert.equal(voiceStateClear.mock.callCount(), 0);
        assert.equal(createQueryBuilder.mock.callCount(), 1);
        assert.equal(updateSession.mock.callCount(), 1);
        assert.deepEqual(updateSession.mock.calls[0].arguments, [{ session_id: "stale-session" }, { status: "offline" }]);
    });
});
