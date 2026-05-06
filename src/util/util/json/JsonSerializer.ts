import { JsonSerializerOptions } from "./JsonSerializerOptions";
import { Worker } from "node:worker_threads";
import { join } from "node:path";
import os from "node:os";
import { ReadStream, WriteStream } from "node:fs";

type JsonArrayStreamState = "awaitArrayStart" | "awaitValueOrEnd" | "readValue" | "done";
type JsonStreamParsedValue<T> = { hasValue: false } | { hasValue: true; value: T };

function isJsonWhitespace(char: string): boolean {
    return char === " " || char === "\n" || char === "\r" || char === "\t";
}

// const worker = new Worker(join(process.cwd(), 'dist', 'util', 'util', 'json', 'jsonWorker.js'));
const workerPool: Worker[] = [];
const numWorkers = process.env.JSON_WORKERS ? parseInt(process.env.JSON_WORKERS) : os.cpus().length;

for (let i = 0; i < numWorkers; i++) {
    console.log("[JsonSerializer] Starting JSON worker", i);
    workerPool.push(new Worker(join(__dirname, "jsonWorker.js")));
    workerPool[i].unref();
    workerPool[i].setMaxListeners(64);
}
let currentWorkerIndex = 0;

function getNextWorker(): Worker {
    const worker = workerPool[currentWorkerIndex];
    currentWorkerIndex = (currentWorkerIndex + 1) % numWorkers;
    return worker;
}

// noinspection JSUnusedLocalSymbols - TODO: implement options
export class JsonSerializer {
    public static Serialize<T>(value: T, opts?: JsonSerializerOptions): string {
        return JSON.stringify(value);
    }
    public static async SerializeAsync<T>(value: T, opts?: JsonSerializerOptions): Promise<string> {
        const worker = getNextWorker();
        worker.postMessage({ type: "serialize", value });
        return new Promise((resolve, reject) => {
            const handler = (msg: { result?: string; error?: string }) => {
                clearTimeout(timeout);
                worker.removeListener("message", handler);
                if (msg.error) {
                    reject(new Error(msg.error));
                } else {
                    resolve(msg.result!);
                }
            };
            worker.on("message", handler);
            const timeout = setTimeout(() => {
                worker.removeListener("message", handler);
                reject(new Error("Worker timeout"));
            }, 60000);
        });
    }
    public static Deserialize<T>(json: string, opts?: JsonSerializerOptions): T {
        return JSON.parse(json) as T;
    }
    public static async DeserializeAsync<T>(json: string | ReadableStream | ReadStream, opts?: JsonSerializerOptions): Promise<T> {
        if (json instanceof ReadableStream) return this.DeserializeAsyncReadableStream<T>(json, opts);
        if (json instanceof ReadStream) return this.DeserializeAsyncReadStream<T>(json, opts);

        const worker = getNextWorker();
        worker.postMessage({ type: "deserialize", json });
        return new Promise((resolve, reject) => {
            const handler = (msg: { result?: string; error?: string }) => {
                clearTimeout(timeout);
                worker.removeListener("message", handler);
                if (msg.error) {
                    reject(new Error(msg.error));
                } else {
                    resolve(JSON.parse(msg.result!) as T);
                }
            };
            worker.on("message", handler);
            const timeout = setTimeout(() => {
                worker.removeListener("message", handler);
                reject(new Error("Worker timeout"));
            }, 60000);
        });
    }

    private static async DeserializeAsyncReadableStream<T>(jsonStream: ReadableStream, opts?: JsonSerializerOptions): Promise<T> {
        const reader = jsonStream.getReader();
        let jsonData = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            jsonData += new TextDecoder().decode(value);
        }
        return this.DeserializeAsync<T>(jsonData, opts);
    }

    private static async DeserializeAsyncReadStream<T>(jsonStream: ReadStream, opts?: JsonSerializerOptions): Promise<T> {
        let jsonData = "";
        for await (const chunk of jsonStream) {
            jsonData += chunk.toString();
        }
        return this.DeserializeAsync<T>(jsonData, opts);
    }

    public static async *DeserializeAsyncEnumerable<T>(json: string | ReadStream | ReadableStream, opts?: JsonSerializerOptions): AsyncGenerator<T, void, unknown> {
        if (json instanceof ReadableStream) return yield* this.DeserializeAsyncEnumerableReadableStream<T>(json, opts);
        if (json instanceof ReadStream) return yield* this.DeserializeAsyncEnumerableReadStream<T>(json, opts);

        const arr = await this.DeserializeAsync<T[]>(json, opts);
        for (const item of arr) {
            yield item;
        }
    }

    private static async *DeserializeAsyncEnumerableReadableStream<T>(json: ReadableStream, opts?: JsonSerializerOptions) {
        yield* this.DeserializeAsyncEnumerableFromChunks<T>(this.DecodeJsonStreamChunks(this.ReadReadableStreamChunks(json)), opts);
    }

    private static async *DeserializeAsyncEnumerableReadStream<T>(json: ReadStream, opts?: JsonSerializerOptions) {
        yield* this.DeserializeAsyncEnumerableFromChunks<T>(this.DecodeJsonStreamChunks(json as AsyncIterable<unknown>), opts);
    }

    private static async *ReadReadableStreamChunks(json: ReadableStream): AsyncGenerator<unknown, void, unknown> {
        const reader = json.getReader();
        let doneReading = false;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    doneReading = true;
                    break;
                }

                yield value;
            }
        } finally {
            if (!doneReading) {
                await reader.cancel();
            }

            reader.releaseLock();
        }
    }

    private static async *DecodeJsonStreamChunks(chunks: AsyncIterable<unknown>): AsyncGenerator<string, void, unknown> {
        const decoder = new TextDecoder();

        for await (const chunk of chunks) {
            if (typeof chunk === "string") {
                const pending = decoder.decode();
                if (pending) yield pending;

                yield chunk;
                continue;
            }

            if (chunk instanceof Uint8Array) {
                const text = decoder.decode(chunk, { stream: true });
                if (text) yield text;
                continue;
            }

            if (chunk instanceof ArrayBuffer) {
                const text = decoder.decode(chunk, { stream: true });
                if (text) yield text;
                continue;
            }

            throw new TypeError("JSON streams must yield string, Uint8Array, or ArrayBuffer chunks.");
        }

        const pending = decoder.decode();
        if (pending) yield pending;
    }

    private static async *DeserializeAsyncEnumerableFromChunks<T>(chunks: AsyncIterable<string>, opts?: JsonSerializerOptions): AsyncGenerator<T, void, unknown> {
        let state: JsonArrayStreamState = "awaitArrayStart";
        let currentValue = "";
        let depth = 0;
        let inString = false;
        let escaped = false;
        let valueComplete = false;
        let canEndArray = true;

        const noValue = { hasValue: false } as const;
        const resetValue = () => {
            currentValue = "";
            depth = 0;
            inString = false;
            escaped = false;
            valueComplete = false;
        };
        const parseValue = () => {
            const json = currentValue.trim();
            if (!json) {
                throw new SyntaxError("Expected JSON value in array.");
            }

            const value = this.Deserialize<T>(json, opts);
            resetValue();
            return value;
        };
        const processValueChar = (char: string): JsonStreamParsedValue<T> => {
            if (valueComplete) {
                if (isJsonWhitespace(char)) {
                    return noValue;
                }

                if (char === ",") {
                    const value = parseValue();
                    state = "awaitValueOrEnd";
                    canEndArray = false;
                    return { hasValue: true, value };
                }

                if (char === "]") {
                    const value = parseValue();
                    state = "done";
                    return { hasValue: true, value };
                }

                throw new SyntaxError("Expected ',' or ']' after JSON array item.");
            }

            if (inString) {
                currentValue += char;

                if (escaped) {
                    escaped = false;
                } else if (char === "\\") {
                    escaped = true;
                } else if (char === '"') {
                    inString = false;
                    if (depth === 0) {
                        valueComplete = true;
                    }
                }

                return noValue;
            }

            if (char === '"') {
                currentValue += char;
                inString = true;
                return noValue;
            }

            if (char === "{" || char === "[") {
                currentValue += char;
                depth++;
                return noValue;
            }

            if (char === "}" || char === "]") {
                if (depth > 0) {
                    currentValue += char;
                    depth--;
                    if (depth === 0) {
                        valueComplete = true;
                    }

                    return noValue;
                }

                if (char === "]") {
                    const value = parseValue();
                    state = "done";
                    return { hasValue: true, value };
                }

                throw new SyntaxError("Unexpected '}' in JSON array.");
            }

            if (char === ",") {
                if (depth > 0) {
                    currentValue += char;
                    return noValue;
                }

                const value = parseValue();
                state = "awaitValueOrEnd";
                canEndArray = false;
                return { hasValue: true, value };
            }

            if (isJsonWhitespace(char)) {
                if (depth > 0) {
                    currentValue += char;
                    return noValue;
                }

                valueComplete = true;
                return noValue;
            }

            currentValue += char;
            return noValue;
        };

        for await (const chunk of chunks) {
            for (const char of chunk) {
                if (state === "done") {
                    if (!isJsonWhitespace(char)) {
                        throw new SyntaxError("Unexpected non-whitespace data after JSON array.");
                    }

                    continue;
                }

                if (state === "awaitArrayStart") {
                    if (isJsonWhitespace(char)) {
                        continue;
                    }

                    if (char !== "[") {
                        throw new SyntaxError("Expected JSON array.");
                    }

                    state = "awaitValueOrEnd";
                    canEndArray = true;
                    continue;
                }

                if (state === "awaitValueOrEnd") {
                    if (isJsonWhitespace(char)) {
                        continue;
                    }

                    if (char === "]") {
                        if (!canEndArray) {
                            throw new SyntaxError("Trailing comma in JSON array.");
                        }

                        state = "done";
                        continue;
                    }

                    if (char === ",") {
                        throw new SyntaxError("Unexpected comma in JSON array.");
                    }

                    resetValue();
                    state = "readValue";
                }

                const result = processValueChar(char);
                if (result.hasValue) {
                    yield result.value;
                }
            }
        }

        if (state === "awaitArrayStart") {
            throw new SyntaxError("Expected JSON array.");
        }

        if (state === "awaitValueOrEnd") {
            throw new SyntaxError("Unexpected end of JSON array.");
        }

        if (state === "readValue") {
            if (inString) {
                throw new SyntaxError("Unterminated string in JSON array item.");
            }

            if (depth > 0) {
                throw new SyntaxError("Unterminated JSON array item.");
            }

            if (valueComplete) {
                throw new SyntaxError("Expected ',' or ']' after JSON array item.");
            }

            throw new SyntaxError("Unexpected end of JSON array item.");
        }
    }

    public static async SerializeAsyncEnumerableToStringAsync<T>(items: AsyncIterable<T>, opts?: JsonSerializerOptions): Promise<string> {
        let jsonData = "[";
        let first = true;
        for await (const item of items) {
            if (!first) {
                jsonData += ",";
            } else {
                first = false;
            }
            jsonData += await this.SerializeAsync(item, opts);
        }
        jsonData += "]";
        return jsonData;
    }

    public static async SerializeAsyncEnumerableAsync<T>(items: AsyncIterable<T>, stream: WriteStream | WritableStream, opts?: JsonSerializerOptions): Promise<void> {}

    private static async SerializeAsyncEnumerableToWritableStreamAsync<T>(items: AsyncIterable<T>, stream: WritableStream, opts?: JsonSerializerOptions): Promise<void> {
        const writer = stream.getWriter();
        let first = true;
        await writer.write(new TextEncoder().encode("["));
        for await (const item of items) {
            if (!first) {
                await writer.write(new TextEncoder().encode(","));
            } else {
                first = false;
            }
            const jsonItem = await this.SerializeAsync(item, opts);
            await writer.write(new TextEncoder().encode(jsonItem));
        }
        await writer.write(new TextEncoder().encode("]"));
        await writer.close();
    }

    private static async SerializeAsyncEnumerableToWriteStreamAsync<T>(items: AsyncIterable<T>, stream: WriteStream, opts?: JsonSerializerOptions): Promise<void> {
        let first = true;
        stream.write("[");
        for await (const item of items) {
            if (!first) {
                stream.write(",");
            } else {
                first = false;
            }
            const jsonItem = await this.SerializeAsync(item, opts);
            stream.write(jsonItem);
        }
        stream.write("]");
        stream.end();
    }
}
