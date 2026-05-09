import { JsonSerializer } from "./JsonSerializer";
import { after, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Stopwatch } from "../Stopwatch";
import { JsonValue } from "@protobuf-ts/runtime";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

describe("JsonSerializer", () => {
    after(async () => {
        await JsonSerializer.ShutdownAsync();
    });

    it("should serialize synchronously", () => {
        const obj = { a: 1, b: "test" };
        const result = JsonSerializer.Serialize(obj);
        assert.equal(result, '{"a":1,"b":"test"}');
    });

    it("should apply synchronous serializer options", () => {
        const result = JsonSerializer.Serialize(
            { visible: 1, hidden: 2, nested: { hidden: 3, visible: 4 } },
            {
                replacer(key, value) {
                    return key === "hidden" ? undefined : value;
                },
                space: 2,
            },
        );

        assert.equal(result, '{\n  "visible": 1,\n  "nested": {\n    "visible": 4\n  }\n}');
    });

    it("should deserialize synchronously", () => {
        const json = '{"a":1,"b":"test"}';
        const result = JsonSerializer.Deserialize(json);
        assert.deepEqual(result, { a: 1, b: "test" });
    });

    it("should apply synchronous deserializer options", () => {
        const result = JsonSerializer.Deserialize<{ createdAt: Date }>(`{"createdAt":"2026-05-08T12:00:00.000Z"}`, {
            reviver(key, value) {
                return key === "createdAt" && typeof value === "string" ? new Date(value) : value;
            },
        });

        assert.equal(result.createdAt instanceof Date, true);
        assert.equal(result.createdAt.toISOString(), "2026-05-08T12:00:00.000Z");
    });

    it("should serialize asynchronously", async () => {
        const obj = { a: 1, b: "test" };
        const result = await JsonSerializer.SerializeAsync(obj);
        assert.equal(result, '{"a":1,"b":"test"}');
    });

    it("should apply cloneable serializer options asynchronously", async () => {
        const result = await JsonSerializer.SerializeAsync({ a: 1, b: 2 }, { replacer: ["b"], space: 2 });

        assert.equal(result, '{\n  "b": 2\n}');
    });

    it("should apply function serializer options asynchronously", async () => {
        const result = await JsonSerializer.SerializeAsync(
            { keep: 1, omit: 2 },
            {
                replacer(key, value) {
                    return key === "omit" ? undefined : value;
                },
            },
        );

        assert.equal(result, '{"keep":1}');
    });

    it("should deserialize asynchronously", async () => {
        const json = '{"a":1,"b":"test"}';
        const result = await JsonSerializer.DeserializeAsync(json);
        assert.deepEqual(result, { a: 1, b: "test" });
    });

    it("should apply deserializer options asynchronously", async () => {
        const result = await JsonSerializer.DeserializeAsync<{ value: number }>(`{"value":"42"}`, {
            reviver(key, value) {
                return key === "value" ? Number(value) : value;
            },
        });

        assert.deepEqual(result, { value: 42 });
    });

    it("should apply async deserializer revivers with JSON.parse semantics", async () => {
        const value = await JsonSerializer.DeserializeAsync<number>("-0", {
            reviver(key, parsedValue) {
                return key === "" && Object.is(parsedValue, -0) ? -1 : parsedValue;
            },
        });

        assert.equal(value, -1);
    });

    it("should apply async stream deserializer revivers", async () => {
        const tempDir = await fs.mkdtemp(join(process.cwd(), "json-deserialize-stream-"));
        const inputPath = join(tempDir, "input.json");
        await fs.writeFile(inputPath, `{"value":"😀"}`);
        const reviver = (key: string, value: unknown) => (key === "value" && typeof value === "string" ? `${value}!` : value);

        try {
            assert.deepEqual(await JsonSerializer.DeserializeAsync<{ value: string }>(createReadStream(inputPath, { highWaterMark: 1 }), { reviver }), {
                value: "😀!",
            });

            const encodedJson = new TextEncoder().encode(`{"value":"😀"}`);

            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    for (const byte of encodedJson) {
                        controller.enqueue(Uint8Array.of(byte));
                    }
                    controller.close();
                },
            });

            assert.deepEqual(await JsonSerializer.DeserializeAsync<{ value: string }>(stream, { reviver }), { value: "😀!" });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("should serialize async enumerable items to strings with options", async () => {
        async function* getItems() {
            yield { id: 1, hidden: "omit" };
            yield { id: 2, hidden: "omit" };
        }

        const result = await JsonSerializer.SerializeAsyncEnumerableToStringAsync(getItems(), { replacer: ["id"], space: 2 });

        assert.equal(result, '[{\n  "id": 1\n},{\n  "id": 2\n}]');
    });

    it("should serialize async enumerable items to node streams with options", async () => {
        const tempDir = await fs.mkdtemp(join(process.cwd(), "json-serialize-stream-"));
        const outputPath = join(tempDir, "output.json");

        async function* getItems() {
            yield { id: 1, hidden: "omit" };
            yield { id: 2, hidden: "omit" };
        }

        try {
            await JsonSerializer.SerializeAsyncEnumerableAsync(getItems(), createWriteStream(outputPath), { replacer: ["id"], space: 2 });

            assert.equal(await fs.readFile(outputPath, "utf8"), '[{\n  "id": 1\n},{\n  "id": 2\n}]');
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("should serialize async enumerable items to web streams with function options", async () => {
        const chunks: Uint8Array[] = [];
        const stream = new WritableStream<Uint8Array>({
            write(chunk) {
                chunks.push(chunk);
            },
        });

        async function* getItems() {
            yield { keep: 1, omit: "hidden" };
            yield { keep: 2, omit: "hidden" };
        }

        await JsonSerializer.SerializeAsyncEnumerableAsync(getItems(), stream, {
            replacer(key, value) {
                return key === "omit" ? undefined : value;
            },
        });

        assert.equal(
            chunks.reduce((json, chunk) => json + new TextDecoder().decode(chunk), ""),
            '[{"keep":1},{"keep":2}]',
        );
    });

    it("should keep concurrent worker responses matched to their requests", async () => {
        const values = Array.from({ length: 64 }, (_, index) => ({ index, payload: `value-${index}` }));
        const results = await Promise.all(values.map((value) => JsonSerializer.DeserializeAsync<typeof value>(JSON.stringify(value))));

        assert.deepEqual(results, values);
    });

    it("should not emit listener leak warnings with many concurrent worker tasks", async () => {
        const script = `
            process.on("warning", (warning) => {
                if (warning.name === "MaxListenersExceededWarning") {
                    console.error(warning.stack || warning.message);
                    process.exitCode = 2;
                }
            });

            const { JsonSerializer } = require("./dist/util/util/json/JsonSerializer.js");
            Promise.all(Array.from({ length: 128 }, (_, index) => JsonSerializer.DeserializeAsync(JSON.stringify({ index })))).then(async (results) => {
                if (results.some((result, index) => result.index !== index)) process.exitCode = 3;
                await JsonSerializer.ShutdownAsync();
            }).catch((error) => {
                console.error(error);
                process.exit(4);
            });
        `;

        const { stderr } = await execFileAsync(process.execPath, ["-e", script], {
            cwd: process.cwd(),
            env: { ...process.env, JSON_WORKERS: "1" },
        });

        assert.doesNotMatch(stderr, /MaxListenersExceededWarning/);
    });

    it("should fall back to the default worker count for invalid JSON_WORKERS values", async () => {
        const script = `
            const { JsonSerializer } = require("./dist/util/util/json/JsonSerializer.js");
            JsonSerializer.DeserializeAsync(JSON.stringify({ ok: true })).then(async (result) => {
                if (!result.ok) process.exitCode = 2;
                await JsonSerializer.ShutdownAsync();
            }).catch((error) => {
                console.error(error);
                process.exit(3);
            });
        `;

        await execFileAsync(process.execPath, ["-e", script], {
            cwd: process.cwd(),
            env: { ...process.env, JSON_WORKERS: "not-a-number" },
        });
    });

    it("should recover after a worker exits unexpectedly", async () => {
        const tempDir = await fs.mkdtemp(join(process.cwd(), "json-worker-test-"));

        try {
            const tempSerializerPath = join(tempDir, "JsonSerializer.js");
            const tempWorkerPath = join(tempDir, "jsonWorker.js");
            const stripSourceMapReference = (code: string) => code.replace(/\n\/\/# sourceMappingURL=.*\n?$/u, "\n");
            const healthyWorker = stripSourceMapReference(await fs.readFile(join(__dirname, "jsonWorker.js"), "utf8"));

            await fs.writeFile(tempSerializerPath, stripSourceMapReference(await fs.readFile(join(__dirname, "JsonSerializer.js"), "utf8")));
            await fs.writeFile(
                tempWorkerPath,
                `
                    const { parentPort } = require("node:worker_threads");
                    parentPort.on("message", () => process.exit(42));
                `,
            );

            const script = `
                const fs = require("node:fs/promises");
                const { JsonSerializer } = require(${JSON.stringify(tempSerializerPath)});

                (async () => {
                    let rejectedExitedWorker = false;
                    try {
                        await JsonSerializer.DeserializeAsync(JSON.stringify({ first: true }));
                    } catch (error) {
                        rejectedExitedWorker = /exited with code 42/.test(error.message);
                    }

                    if (!rejectedExitedWorker) {
                        console.error("first request did not reject with the worker exit");
                        process.exit(2);
                    }

                    await fs.writeFile(${JSON.stringify(tempWorkerPath)}, ${JSON.stringify(healthyWorker)});
                    const result = await JsonSerializer.DeserializeAsync(JSON.stringify({ ok: true }));
                    if (!result.ok) process.exit(3);
                    await JsonSerializer.ShutdownAsync();
                })().catch((error) => {
                    console.error(error);
                    process.exit(4);
                });
            `;

            await execFileAsync(process.execPath, ["-e", script], {
                cwd: process.cwd(),
                env: { ...process.env, JSON_WORKERS: "1" },
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    it("should be able to read large file", async () => {
        // write a massive json file
        const sw = Stopwatch.startNew();
        const jsonfile = await fs.open("large.json", "w");
        await jsonfile.write("[");
        const getLargeObj = (index: number, depth: number) => {
            const obj: JsonValue = {};

            if (depth === 0) {
                return obj;
            }
            for (let i = 0; i < 10; i++) {
                obj[`key${i}`] = getLargeObj(index * 10 + i, depth - 1);
            }
            return obj;
        };
        for (let i = 0; i < 100; i++) {
            const entry = JSON.stringify(getLargeObj(i, 5));
            await jsonfile.write(entry);
            if (i < 99) {
                await jsonfile.write(",");
            }
        }
        await jsonfile.write("]");
        await jsonfile.close();
        process.stdout.write("Large file written in " + sw.elapsed().toString() + "\n");

        const jsonData = await fs.readFile("large.json", "utf-8");

        const start = process.hrtime.bigint();
        const obj = await JsonSerializer.DeserializeAsync<{ key: string; value: string }[]>(jsonData);
        const end = process.hrtime.bigint();
        const duration = end - start;
        console.log(`Deserialization took ${duration / BigInt(1e6)} ms`);

        assert.equal(obj.length, 100);
        await fs.unlink("large.json");
    });

    it("should be able to parallelise", async () => {
        // write a massive json file
        const sw = Stopwatch.startNew();
        const jsonfile = await fs.open("large.json", "w");
        await jsonfile.write("[");
        const getLargeObj = (index: number, depth: number) => {
            const obj: JsonValue = {};

            if (depth === 0) {
                return obj;
            }
            for (let i = 0; i < 5; i++) {
                obj[`key${i}`] = getLargeObj(index * 10 + i, depth - 1);
            }
            return obj;
        };
        for (let i = 0; i < 50; i++) {
            const entry = JSON.stringify(getLargeObj(i, 5));
            await jsonfile.write(entry);
            if (i < 49) {
                await jsonfile.write(",");
            }
        }
        await jsonfile.write("]");
        await jsonfile.close();
        process.stdout.write("Large file written in " + sw.elapsed().toString() + "\n");

        const tasks = [];
        const start = process.hrtime.bigint();
        for (let i = 0; i < 64; i++) {
            tasks.push(
                (async () => {
                    const jsonData = await fs.readFile("large.json", "utf-8");

                    const obj = await JsonSerializer.DeserializeAsync<{ key: string; value: string }[]>(jsonData);
                    const end = process.hrtime.bigint();
                    const duration = end - start;
                    console.log(`Deserialization took ${duration / BigInt(1e6)} ms`);

                    assert.equal(obj.length, 50);
                })(),
            );
        }
        await Promise.all(tasks);
        await fs.unlink("large.json");
    });
});
