import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { OPCODES } from "../util/Constants";
import type { WebSocket } from "../util/WebSocket";
import { Message } from "./Message";

type TestSocket = WebSocket & {
    closeCalls: number[];
};

function createSocket(overrides: Partial<TestSocket> = {}): TestSocket {
    const socket = {
        encoding: "json",
        user_id: "test-user",
        closeCalls: [] as number[],
        close(code?: number) {
            if (code !== undefined) this.closeCalls.push(code);
            return this;
        },
        ...overrides,
    };

    return socket as unknown as TestSocket;
}

const clientInitSessionPayload = Buffer.from(JSON.stringify({ op: OPCODES.ClientInitSession, d: {} }));

describe("gateway Message compression", () => {
    test("inflates zlib-stream JSON buffers before dispatching", async () => {
        const decodedBuffers: Buffer[] = [];
        const socket = createSocket({
            compress: "zlib-stream",
            inflate: {
                process(buffer: Buffer) {
                    decodedBuffers.push(buffer);
                    return clientInitSessionPayload;
                },
            } as never,
        });
        const compressedFrame = Buffer.from([0x78, 0x9c, 0x00, 0x00, 0xff, 0xff]);

        await Message.call(socket, compressedFrame);

        assert.deepEqual(decodedBuffers, [compressedFrame]);
        assert.deepEqual(socket.closeCalls, []);
    });

    test("decodes zstd-stream JSON buffers before dispatching", async () => {
        const decodedBuffers: Buffer[] = [];
        const socket = createSocket({
            compress: "zstd-stream",
            zstdDecoder: {
                async decode(buffer: Buffer) {
                    decodedBuffers.push(buffer);
                    return clientInitSessionPayload;
                },
            } as never,
        });
        const compressedFrame = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

        await Message.call(socket, compressedFrame);

        assert.deepEqual(decodedBuffers, [compressedFrame]);
        assert.deepEqual(socket.closeCalls, []);
    });
});
