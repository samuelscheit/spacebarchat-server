import { FixtureManifest } from "../fixtures/manifest.js";
import { normalizeUrl } from "../processors/normalize.js";
import { redactHeaders, redactJsonValue, redactText } from "../processors/redact.js";
import { shapeResult } from "../processors/shape.js";
import { CaptureEvent, HttpMethod } from "../types.js";
import { tryParseJson, isRecord } from "../util/json.js";
import { GatewayZlibStreamDecoder } from "./gatewayCompression.js";
import { NdjsonEventWriter } from "./ndjson.js";

export interface PlaywrightEventEmitterLike {
    on(event: string, handler: (...args: unknown[]) => void): unknown;
    off?(event: string, handler: (...args: unknown[]) => void): unknown;
    removeListener?(event: string, handler: (...args: unknown[]) => void): unknown;
}

export interface PlaywrightRequestLike {
    url(): string;
    method(): string;
    headers(): Record<string, string>;
    postData?(): string | null;
}

export interface PlaywrightResponseLike {
    url(): string;
    status(): number;
    headers(): Record<string, string>;
    request?(): PlaywrightRequestLike;
}

export interface PlaywrightWebSocketLike extends PlaywrightEventEmitterLike {
    url(): string;
}

export interface PlaywrightConvenienceRecorderOptions {
    runId: string;
    featureId: string;
    page: PlaywrightEventEmitterLike;
    outputPath: string;
    fixtures?: FixtureManifest;
    failOnSecret?: boolean;
    getCurrentStep?: () => string | undefined;
}

export interface PlaywrightConvenienceRecorder {
    start(): Promise<void>;
    flush(): Promise<void>;
    stop(): Promise<void>;
}

export function createPlaywrightConvenienceRecorder(options: PlaywrightConvenienceRecorderOptions): PlaywrightConvenienceRecorder {
    const pending = new Set<Promise<void>>();
    const errors: unknown[] = [];
    const disposers: Array<() => void> = [];
    let writer: NdjsonEventWriter | undefined;
    let nextSocketId = 0;
    let nextRequestId = 0;
    const requestIds = new WeakMap<PlaywrightRequestLike, string>();
    const gatewayDecoders = new Map<string, GatewayZlibStreamDecoder>();

    const enqueue = (work: Promise<void>): void => {
        const pendingWork = work
            .catch((error: unknown) => {
                errors.push(error);
            })
            .finally(() => {
                pending.delete(pendingWork);
            });
        pending.add(pendingWork);
    };

    const emit = async (event: CaptureEvent): Promise<void> => {
        await writer?.write(event);
    };

    const attach = (target: PlaywrightEventEmitterLike, eventName: string, handler: (...args: unknown[]) => void): void => {
        target.on(eventName, handler);
        disposers.push(() => {
            if (target.off) {
                target.off(eventName, handler);
            } else {
                target.removeListener?.(eventName, handler);
            }
        });
    };

    const playwrightRequestId = (request: PlaywrightRequestLike): string => {
        const existing = requestIds.get(request);
        if (existing) {
            return existing;
        }
        const requestId = `playwright-request-${(nextRequestId += 1)}`;
        requestIds.set(request, requestId);
        return requestId;
    };

    return {
        async start() {
            writer = await NdjsonEventWriter.open({
                filePath: options.outputPath,
                fixtures: options.fixtures,
                failOnSecret: options.failOnSecret,
            });

            attach(options.page, "request", (request) => {
                enqueue(recordRequest(request as PlaywrightRequestLike));
            });
            attach(options.page, "response", (response) => {
                enqueue(recordResponse(response as PlaywrightResponseLike));
            });
            attach(options.page, "websocket", (webSocket) => {
                enqueue(recordWebSocket(webSocket as PlaywrightWebSocketLike, `playwright-ws-${(nextSocketId += 1)}`));
            });
        },
        async flush() {
            await Promise.all([...pending]);
            if (errors.length > 0) {
                throw errors[0];
            }
        },
        async stop() {
            for (const dispose of [...disposers].reverse()) {
                dispose();
            }
            await this.flush();
            for (const decoder of gatewayDecoders.values()) {
                decoder.close();
            }
            gatewayDecoders.clear();
            await writer?.close();
            writer = undefined;
        },
    };

    async function recordRequest(request: PlaywrightRequestLike): Promise<void> {
        const url = request.url();
        if (!isHttpApiUrl(url)) {
            return;
        }

        const body = request.postData?.();
        const redactedBody = body ? redactedBodyFromText(body, options.fixtures) : undefined;
        const bodyShape = typeof redactedBody === "undefined" ? undefined : shapeResult(redactedBody);
        const normalized = normalizeUrl(url, { fixtures: options.fixtures });
        await emit({
            run_id: options.runId,
            feature_id: options.featureId,
            step_id: options.getCurrentStep?.(),
            ts_monotonic_ms: performance.now(),
            kind: "playwright.http.request",
            playwright_request_id: playwrightRequestId(request),
            method: request.method() as HttpMethod,
            url: redactText(url, { fixtures: options.fixtures }),
            normalized_route: normalized.normalized_route,
            headers_redacted: true,
            request_headers_redacted: redactHeaders(request.headers(), { fixtures: options.fixtures }),
            request_body_shape_hash: bodyShape?.hash,
            request_body_shape: bodyShape?.shape,
            request_body_redacted: redactedBody,
        });
    }

    async function recordResponse(response: PlaywrightResponseLike): Promise<void> {
        const url = response.url();
        if (!isHttpApiUrl(url)) {
            return;
        }

        const request = response.request?.();
        const normalized = normalizeUrl(url, { fixtures: options.fixtures });
        await emit({
            run_id: options.runId,
            feature_id: options.featureId,
            step_id: options.getCurrentStep?.(),
            ts_monotonic_ms: performance.now(),
            kind: "playwright.http.response",
            playwright_request_id: request ? playwrightRequestId(request) : `playwright-response-without-request-${(nextRequestId += 1)}`,
            method: request?.method(),
            url: redactText(url, { fixtures: options.fixtures }),
            normalized_route: normalized.normalized_route,
            status: response.status(),
            headers_redacted: true,
            response_headers_redacted: redactHeaders(response.headers(), { fixtures: options.fixtures }),
        });
    }

    async function recordWebSocket(webSocket: PlaywrightWebSocketLike, webSocketId: string): Promise<void> {
        const url = webSocket.url();
        attach(webSocket, "framesent", (payload) => {
            enqueue(recordWebSocketFrame(webSocketId, url, "sent", payload));
        });
        attach(webSocket, "framereceived", (payload) => {
            enqueue(recordWebSocketFrame(webSocketId, url, "received", payload));
        });
        attach(webSocket, "socketerror", (error) => {
            enqueue(
                emit({
                    run_id: options.runId,
                    feature_id: options.featureId,
                    step_id: options.getCurrentStep?.(),
                    ts_monotonic_ms: performance.now(),
                    kind: "playwright.ws.error",
                    websocket_id: webSocketId,
                    url: redactText(url, { fixtures: options.fixtures }),
                    error_text: error instanceof Error ? error.message : String(error),
                }),
            );
        });
        attach(webSocket, "close", () => {
            enqueue(
                emit({
                    run_id: options.runId,
                    feature_id: options.featureId,
                    step_id: options.getCurrentStep?.(),
                    ts_monotonic_ms: performance.now(),
                    kind: "playwright.ws.closed",
                    websocket_id: webSocketId,
                    url: redactText(url, { fixtures: options.fixtures }),
                }),
            );
        });

        await emit({
            run_id: options.runId,
            feature_id: options.featureId,
            step_id: options.getCurrentStep?.(),
            ts_monotonic_ms: performance.now(),
            kind: "playwright.ws.created",
            websocket_id: webSocketId,
            url: redactText(url, { fixtures: options.fixtures }),
        });
    }

    async function recordWebSocketFrame(webSocketId: string, url: string, direction: "sent" | "received", payload: unknown): Promise<void> {
        const payloadText = await payloadToText(webSocketId, direction, payload);
        const parsed = typeof payloadText === "undefined" ? undefined : tryParseJson(payloadText);
        const redacted =
            typeof payloadText === "undefined"
                ? "{binary_frame}"
                : typeof parsed === "undefined"
                  ? redactText(payloadText, { fixtures: options.fixtures })
                  : redactJsonValue(parsed, { fixtures: options.fixtures });
        const payloadShape = shapeResult(redacted);
        const envelope = isRecord(parsed) ? parsed : undefined;

        await emit({
            run_id: options.runId,
            feature_id: options.featureId,
            step_id: options.getCurrentStep?.(),
            ts_monotonic_ms: performance.now(),
            kind: direction === "sent" ? "playwright.ws.frame.sent" : "playwright.ws.frame.received",
            websocket_id: webSocketId,
            url: redactText(url, { fixtures: options.fixtures }),
            direction,
            opcode: numberField(envelope?.op),
            gateway_event: stringField(envelope?.t),
            sequence: numberField(envelope?.s),
            payload_shape_hash: payloadShape.hash,
            payload_shape: payloadShape.shape,
            payload_redacted: redacted,
        });
    }

    async function payloadToText(webSocketId: string, direction: "sent" | "received", payload: unknown): Promise<string | undefined> {
        const text = payloadTextFromUnknown(payload);
        if (typeof text === "string") {
            return text;
        }
        if (direction !== "received") {
            return undefined;
        }

        const buffer = payloadBufferFromUnknown(payload);
        if (!buffer) {
            return undefined;
        }

        let decoder = gatewayDecoders.get(webSocketId);
        if (!decoder) {
            decoder = new GatewayZlibStreamDecoder();
            gatewayDecoders.set(webSocketId, decoder);
        }
        return decoder.decodeBuffer(buffer);
    }
}

function redactedBodyFromText(text: string, fixtures?: FixtureManifest): unknown {
    const parsed = tryParseJson(text);
    if (typeof parsed === "undefined") {
        return redactText(text, { fixtures });
    }
    return redactJsonValue(parsed, { fixtures });
}

function payloadTextFromUnknown(payload: unknown): string | undefined {
    if (typeof payload === "string") {
        return payload;
    }
    if (Buffer.isBuffer(payload)) {
        return undefined;
    }
    if (isRecord(payload) && typeof payload.payload === "string") {
        return payload.payload;
    }
    return undefined;
}

function payloadBufferFromUnknown(payload: unknown): Buffer | undefined {
    if (Buffer.isBuffer(payload)) {
        return payload;
    }
    if (isRecord(payload) && Buffer.isBuffer(payload.payload)) {
        return payload.payload;
    }
    return undefined;
}

function isHttpApiUrl(url: string): boolean {
    try {
        return new URL(url).pathname.startsWith("/api/");
    } catch {
        return false;
    }
}

function stringField(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function numberField(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
}
