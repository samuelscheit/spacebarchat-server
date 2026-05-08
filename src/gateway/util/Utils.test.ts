import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { handleOffloadedGatewayRequest } from "./Utils";
import { OPCODES, type Payload } from "./Constants";
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

function createSocket() {
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
        close() {
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

            const offload = handleOffloadedGatewayRequest(socket, "http://offload.example/gateway", { guild_id: "guild" });

            controller.enqueue(encoder.encode('[{"event":"FIRST_EVENT","data":{"id":1}},'));

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

            controller.enqueue(encoder.encode('{"event":"SECOND_EVENT","data":{"id":2}}]'));
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
            assert.equal(socket.sequence, 44);
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
