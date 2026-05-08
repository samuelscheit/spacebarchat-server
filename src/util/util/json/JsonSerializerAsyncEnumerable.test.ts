import { JsonSerializer } from "./JsonSerializer";
import { after, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 500) {
    let timeout: NodeJS.Timeout | undefined;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
            }),
        ]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

async function collect<T>(items: AsyncIterable<T>) {
    const collected: T[] = [];
    for await (const item of items) {
        collected.push(item);
    }
    return collected;
}

describe("JsonSerializer async enumerable streams", () => {
    after(async () => {
        await JsonSerializer.ShutdownAsync();
    });

    it("deserializes from a node read stream", async () => {
        const root = await fs.mkdtemp(join(tmpdir(), "spacebar-json-stream-"));
        const path = join(root, "stream.json");
        const expected = [
            { id: 1, text: "hello, [world]", nested: { values: [true, null, "😀"] } },
            { id: 2, text: "brace } inside a string" },
            { id: 3, text: "done" },
        ];
        await fs.writeFile(path, JSON.stringify(expected));

        try {
            const items = await collect(JsonSerializer.DeserializeAsyncEnumerable<(typeof expected)[number]>(createReadStream(path, { highWaterMark: 2 })));

            assert.deepEqual(items, expected);
        } finally {
            await fs.rm(root, { recursive: true, force: true });
        }
    });

    it("yields node read stream items before the stream reaches EOF", async () => {
        const root = await fs.mkdtemp(join(tmpdir(), "spacebar-json-stream-"));
        const path = join(root, "stream.json");
        await fs.writeFile(path, `[{"id":1},{"id":2,"payload":"${"x".repeat(1024 * 1024)}"}]`);

        const stream = createReadStream(path, { highWaterMark: 8 });
        const iterator = JsonSerializer.DeserializeAsyncEnumerable<{ id: number; payload?: string }>(stream)[Symbol.asyncIterator]();
        let ended = false;
        stream.on("end", () => {
            ended = true;
        });

        try {
            assert.deepEqual(await withTimeout(iterator.next(), "Timed out waiting for first streamed JSON item."), {
                done: false,
                value: { id: 1 },
            });
            assert.equal(ended, false);
        } finally {
            await iterator.return?.();
            stream.destroy();
            await fs.rm(root, { recursive: true, force: true });
        }
    });

    it("yields web stream items before the stream reaches EOF", async () => {
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            start(value) {
                controller = value;
            },
        });
        const iterator = JsonSerializer.DeserializeAsyncEnumerable<{ id: number }>(stream)[Symbol.asyncIterator]();

        controller.enqueue(encoder.encode('[{"id":1},'));

        assert.deepEqual(await withTimeout(iterator.next(), "Timed out waiting for first streamed JSON item."), {
            done: false,
            value: { id: 1 },
        });

        controller.enqueue(encoder.encode('{"id":2}]'));
        controller.close();

        assert.deepEqual(await iterator.next(), { done: false, value: { id: 2 } });
        assert.deepEqual(await iterator.next(), { done: true, value: undefined });
    });

    it("cancels web streams when iteration stops before EOF", async () => {
        let canceled = false;
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('[{"id":1},'));
            },
            cancel() {
                canceled = true;
            },
        });
        const iterator = JsonSerializer.DeserializeAsyncEnumerable<{ id: number }>(stream)[Symbol.asyncIterator]();

        assert.deepEqual(await withTimeout(iterator.next(), "Timed out waiting for first streamed JSON item."), {
            done: false,
            value: { id: 1 },
        });

        await iterator.return?.();

        assert.equal(canceled, true);
    });

    it("deserializes from a web readable stream", async () => {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(
            JSON.stringify([
                { id: 1, text: "😀" },
                { id: 2, text: "comma, inside string" },
            ]),
        );
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoded.slice(0, 13));
                controller.enqueue(encoded.slice(13, 17));
                controller.enqueue(encoded.slice(17));
                controller.close();
            },
        });

        const items = await collect(JsonSerializer.DeserializeAsyncEnumerable<{ id: number; text: string }>(stream));

        assert.deepEqual(items, [
            { id: 1, text: "😀" },
            { id: 2, text: "comma, inside string" },
        ]);
    });

    it("applies revivers consistently for strings and streams", async () => {
        const json = JSON.stringify([{ value: "1" }, { value: "2" }]);
        const expected = [{ value: 2 }, { value: 1, first: true }];
        const reviver = (key: string, value: unknown) => {
            if (key === "value" && typeof value === "string") return Number(value);
            if (key === "0" && value && typeof value === "object" && !Array.isArray(value)) return { ...(value as Record<string, unknown>), first: true };
            if (key === "" && Array.isArray(value)) return value.slice().reverse();
            return value;
        };
        const root = await fs.mkdtemp(join(tmpdir(), "spacebar-json-stream-"));
        const path = join(root, "stream.json");
        await fs.writeFile(path, json);
        const encoder = new TextEncoder();
        const encoded = encoder.encode(json);
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoded.slice(0, 5));
                controller.enqueue(encoded.slice(5));
                controller.close();
            },
        });

        try {
            assert.deepEqual(await collect(JsonSerializer.DeserializeAsyncEnumerable<(typeof expected)[number]>(json, { reviver })), expected);
            assert.deepEqual(
                await collect(JsonSerializer.DeserializeAsyncEnumerable<(typeof expected)[number]>(createReadStream(path, { highWaterMark: 2 }), { reviver })),
                expected,
            );
            assert.deepEqual(await collect(JsonSerializer.DeserializeAsyncEnumerable<(typeof expected)[number]>(stream, { reviver })), expected);
        } finally {
            await fs.rm(root, { recursive: true, force: true });
        }
    });

    it("yields no items for an empty array", async () => {
        const stringItems = await collect(JsonSerializer.DeserializeAsyncEnumerable<string>("[]"));
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(" [\n\t] "));
                controller.close();
            },
        });
        const streamItems = await collect(JsonSerializer.DeserializeAsyncEnumerable<string>(stream));

        assert.deepEqual(stringItems, []);
        assert.deepEqual(streamItems, []);
    });

    it("rejects invalid JSON during iteration", async () => {
        await assert.rejects(async () => {
            for await (const _item of JsonSerializer.DeserializeAsyncEnumerable("{")) {
                // Iteration triggers deserialization before yielding the first item.
            }
        }, /JSON|property name|position/);
    });

    it("rejects invalid JSON from streams during iteration", async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('[{"id":1},]'));
                controller.close();
            },
        });

        await assert.rejects(() => collect(JsonSerializer.DeserializeAsyncEnumerable<{ id: number }>(stream)), /Trailing comma|JSON|Expected/);
    });
});
