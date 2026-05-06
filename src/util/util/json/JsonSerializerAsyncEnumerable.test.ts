import { JsonSerializer } from "./JsonSerializer";
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function collect<T>(items: AsyncIterable<T>) {
    const collected: T[] = [];
    for await (const item of items) {
        collected.push(item);
    }
    return collected;
}

describe("JsonSerializer async enumerable streams", () => {
    it("deserializes from a node read stream", async () => {
        const root = await fs.mkdtemp(join(tmpdir(), "spacebar-json-stream-"));
        const path = join(root, "stream.json");
        await fs.writeFile(path, JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]));

        try {
            const items = await collect(JsonSerializer.DeserializeAsyncEnumerable<{ id: number }>(createReadStream(path)));

            assert.deepEqual(items, [{ id: 1 }, { id: 2 }, { id: 3 }]);
        } finally {
            await fs.rm(root, { recursive: true, force: true });
        }
    });

    it("deserializes from a web readable stream", async () => {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(JSON.stringify([{ id: 1 }, { id: 2 }])));
                controller.close();
            },
        });

        const items = await collect(JsonSerializer.DeserializeAsyncEnumerable<{ id: number }>(stream));

        assert.deepEqual(items, [{ id: 1 }, { id: 2 }]);
    });

    it("yields no items for an empty array", async () => {
        const items = await collect(JsonSerializer.DeserializeAsyncEnumerable<string>("[]"));

        assert.deepEqual(items, []);
    });

    it("rejects invalid JSON during iteration", async () => {
        await assert.rejects(async () => {
            for await (const _item of JsonSerializer.DeserializeAsyncEnumerable("{")) {
                // Iteration triggers deserialization before yielding the first item.
            }
        }, /JSON|property name|position/);
    });
});
