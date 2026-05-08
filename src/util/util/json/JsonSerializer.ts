import { JsonSerializerOptions } from "./JsonSerializerOptions";
import { Worker } from "node:worker_threads";
import { join } from "node:path";
import os from "node:os";
import { ReadStream, WriteStream } from "node:fs";
import { once } from "node:events";

type JsonWorkerMessage = {
    id: number;
    result?: string;
    error?: string;
};

type CloneableJsonSerializerOptions = Pick<JsonSerializerOptions, "replacer" | "space">;

type JsonArrayStreamState = "awaitArrayStart" | "awaitValueOrEnd" | "readValue" | "done";
type JsonStreamParsedValue<T> = { hasValue: false } | { hasValue: true; value: T };

function isJsonWhitespace(char: string): boolean {
    return char === " " || char === "\n" || char === "\r" || char === "\t";
}

type PendingJsonWorkerRequest = {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    worker: Worker;
};

const DEFAULT_WORKER_COUNT_LIMIT = 8;
const WORKER_TIMEOUT_MS = 60000;
const workerPool: Worker[] = [];
const pendingRequests = new Map<number, PendingJsonWorkerRequest>();
let currentWorkerIndex = 0;
let requestId = 0;

function getJsonWorkerCount() {
    const configuredWorkers = process.env.JSON_WORKERS?.trim();
    const parsedConfiguredWorkers = configuredWorkers ? Number.parseInt(configuredWorkers, 10) : undefined;
    if (parsedConfiguredWorkers !== undefined && Number.isFinite(parsedConfiguredWorkers)) return Math.max(1, parsedConfiguredWorkers);

    return Math.max(1, Math.min(os.availableParallelism?.() ?? os.cpus().length, DEFAULT_WORKER_COUNT_LIMIT));
}

function rejectPendingRequests(worker: Worker, error: Error) {
    for (const [id, request] of pendingRequests) {
        if (request.worker !== worker) continue;

        clearTimeout(request.timeout);
        pendingRequests.delete(id);
        request.reject(error);
    }
}

function removeWorkerFromPool(worker: Worker) {
    const workerIndex = workerPool.indexOf(worker);
    if (workerIndex === -1) return;

    workerPool.splice(workerIndex, 1);
    if (workerPool.length === 0) {
        currentWorkerIndex = 0;
    } else if (currentWorkerIndex > workerIndex) {
        currentWorkerIndex--;
    } else if (currentWorkerIndex >= workerPool.length) {
        currentWorkerIndex = 0;
    }
}

function createJsonWorker() {
    const worker = new Worker(join(__dirname, "jsonWorker.js"));
    worker.unref();
    worker.on("message", (msg: JsonWorkerMessage) => {
        const request = pendingRequests.get(msg.id);
        if (!request) return;

        clearTimeout(request.timeout);
        pendingRequests.delete(msg.id);
        if (msg.error) request.reject(new Error(msg.error));
        else request.resolve(msg.result!);
    });
    worker.on("error", (error) => rejectPendingRequests(worker, error instanceof Error ? error : new Error(String(error))));
    worker.on("exit", (code) => {
        removeWorkerFromPool(worker);
        rejectPendingRequests(worker, new Error(`JSON worker exited with code ${code}`));
    });
    return worker;
}

function initializeWorkerPool() {
    if (workerPool.length) return;

    for (let i = 0; i < getJsonWorkerCount(); i++) {
        workerPool.push(createJsonWorker());
    }
}

function getNextWorker(): Worker {
    initializeWorkerPool();
    const worker = workerPool[currentWorkerIndex];
    currentWorkerIndex = (currentWorkerIndex + 1) % workerPool.length;
    return worker;
}

function getCloneableSerializerOptions(opts?: JsonSerializerOptions): CloneableJsonSerializerOptions | undefined {
    if (!opts) return undefined;
    if (typeof opts.replacer === "function") return undefined;

    const cloneableOptions: CloneableJsonSerializerOptions = {};
    if (opts.replacer !== undefined) cloneableOptions.replacer = opts.replacer;
    if (opts.space !== undefined) cloneableOptions.space = opts.space;
    return cloneableOptions;
}

function runWorkerTask(message: { type: "serialize"; value: unknown; opts?: CloneableJsonSerializerOptions } | { type: "deserialize"; json: string }) {
    const id = requestId++;
    const worker = getNextWorker();

    return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error("Worker timeout"));
        }, WORKER_TIMEOUT_MS);

        pendingRequests.set(id, { resolve, reject, timeout, worker });
        try {
            worker.postMessage({ ...message, id });
        } catch (error) {
            clearTimeout(timeout);
            pendingRequests.delete(id);
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

export class JsonSerializer {
    public static async ShutdownAsync(): Promise<void> {
        const workers = workerPool.splice(0);
        currentWorkerIndex = 0;

        for (const [id, request] of pendingRequests) {
            clearTimeout(request.timeout);
            pendingRequests.delete(id);
            request.reject(new Error("JSON serializer worker pool is shutting down"));
        }

        await Promise.all(workers.map((worker) => worker.terminate()));
    }

    public static Serialize<T>(value: T, opts?: JsonSerializerOptions): string {
        return JSON.stringify(value, opts?.replacer as Parameters<typeof JSON.stringify>[1], opts?.space);
    }
    public static async SerializeAsync<T>(value: T, opts?: JsonSerializerOptions): Promise<string> {
        const workerOptions = getCloneableSerializerOptions(opts);
        if (opts && workerOptions === undefined) return this.Serialize(value, opts);

        return runWorkerTask({ type: "serialize", value, opts: workerOptions });
    }
    public static Deserialize<T>(json: string, opts?: JsonSerializerOptions): T {
        return JSON.parse(json, opts?.reviver) as T;
    }
    public static async DeserializeAsync<T>(json: string | ReadableStream | ReadStream, opts?: JsonSerializerOptions): Promise<T> {
        if (json instanceof ReadableStream) return this.DeserializeAsyncReadableStream<T>(json, opts);
        if (json instanceof ReadStream) return this.DeserializeAsyncReadStream<T>(json, opts);
        if (opts?.reviver) return this.Deserialize<T>(json, opts);

        return this.Deserialize<T>(await runWorkerTask({ type: "deserialize", json }), opts);
    }

    private static async DeserializeAsyncReadableStream<T>(jsonStream: ReadableStream, opts?: JsonSerializerOptions): Promise<T> {
        let jsonData = "";
        for await (const chunk of this.DecodeJsonStreamChunks(this.ReadReadableStreamChunks(jsonStream))) {
            jsonData += chunk;
        }
        return this.DeserializeAsync<T>(jsonData, opts);
    }

    private static async DeserializeAsyncReadStream<T>(jsonStream: ReadStream, opts?: JsonSerializerOptions): Promise<T> {
        let jsonData = "";
        for await (const chunk of this.DecodeJsonStreamChunks(jsonStream as AsyncIterable<unknown>)) {
            jsonData += chunk;
        }
        return this.DeserializeAsync<T>(jsonData, opts);
    }

    public static async *DeserializeAsyncEnumerable<T>(json: string | ReadStream | ReadableStream, opts?: JsonSerializerOptions): AsyncGenerator<T, void, unknown> {
        if (opts?.reviver) {
            const arr = await this.DeserializeAsync<T[]>(json, opts);
            for (const item of arr) {
                yield item;
            }
            return;
        }
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

    public static async SerializeAsyncEnumerableAsync<T>(items: AsyncIterable<T>, stream: WriteStream | WritableStream, opts?: JsonSerializerOptions): Promise<void> {
        if (stream instanceof WritableStream) return this.SerializeAsyncEnumerableToWritableStreamAsync(items, stream, opts);
        if (stream instanceof WriteStream) return this.SerializeAsyncEnumerableToWriteStreamAsync(items, stream, opts);

        throw new TypeError("JSON output stream must be a WritableStream or WriteStream.");
    }

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
        try {
            await this.WriteToWriteStreamAsync(stream, "[");
            for await (const item of items) {
                if (!first) {
                    await this.WriteToWriteStreamAsync(stream, ",");
                } else {
                    first = false;
                }
                const jsonItem = await this.SerializeAsync(item, opts);
                await this.WriteToWriteStreamAsync(stream, jsonItem);
            }
            await this.WriteToWriteStreamAsync(stream, "]");
            const finished = once(stream, "finish");
            stream.end();
            await finished;
        } catch (error) {
            stream.destroy(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    private static async WriteToWriteStreamAsync(stream: WriteStream, chunk: string): Promise<void> {
        if (stream.write(chunk)) return;

        await once(stream, "drain");
    }
}
