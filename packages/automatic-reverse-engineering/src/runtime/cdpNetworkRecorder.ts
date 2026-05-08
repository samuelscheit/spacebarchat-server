import { performance } from "node:perf_hooks";

import { FixtureManifest, flattenFixtureIds } from "../fixtures/manifest.js";
import { assertFixtureUrlScope } from "../processors/fixtureScope.js";
import { normalizeUrl } from "../processors/normalize.js";
import { redactHeaders, redactJsonValue, redactText } from "../processors/redact.js";
import { shapeResult } from "../processors/shape.js";
import {
    CaptureEvent,
    FeatureDefinition,
    HttpMethod,
    InitiatorStackFrame,
    RedactedHeaders,
    RouteCatalogEntry,
    RuntimeAbortReason,
    UiActionDetails,
    WebSocketFrameEvent,
} from "../types.js";
import { hashJson } from "../util/hash.js";
import { isRecord, tryParseJson } from "../util/json.js";
import { GatewayZlibStreamDecoder } from "./gatewayCompression.js";

export interface CdpSessionLike {
    on(event: string, handler: (payload: Record<string, unknown>) => void): void;
    send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export interface CdpNetworkRecorderOptions {
    cdp: CdpSessionLike;
    runId: string;
    feature: FeatureDefinition;
    fixtures?: FixtureManifest;
    routeCatalog?: RouteCatalogEntry[];
    onEvent: (event: CaptureEvent) => Promise<void> | void;
    bypassServiceWorker?: boolean;
    enforceFixtureScope?: boolean;
    safetyGates?: RuntimeSafetyGateOptions;
}

export interface RuntimeSafetyGateOptions {
    maxRateLimitResponses?: number;
    abortOnCaptcha?: boolean;
    abortOnCheckpoint?: boolean;
}

export class CaptureAbortError extends Error {
    constructor(
        readonly reason: RuntimeAbortReason,
        message: string,
    ) {
        super(message);
        this.name = "CaptureAbortError";
    }
}

interface RequestState {
    method?: string;
    url?: string;
    normalized_route?: string;
    route_name?: string;
    status?: number;
    step_id?: string;
    request_headers_redacted?: RedactedHeaders;
    response_headers_redacted?: RedactedHeaders;
}

const defaultSafetyGates: Required<RuntimeSafetyGateOptions> = {
    maxRateLimitResponses: 0,
    abortOnCaptcha: true,
    abortOnCheckpoint: true,
};

export class CdpNetworkRecorder {
    private readonly cdp: CdpSessionLike;
    private readonly runId: string;
    private readonly feature: FeatureDefinition;
    private readonly fixtures?: FixtureManifest;
    private readonly routeCatalog: RouteCatalogEntry[];
    private readonly onEvent: (event: CaptureEvent) => Promise<void> | void;
    private readonly bypassServiceWorker: boolean;
    private readonly enforceFixtureScope: boolean;
    private readonly safetyGates: Required<RuntimeSafetyGateOptions>;
    private readonly requests = new Map<string, RequestState>();
    private readonly sockets = new Map<string, string>();
    private readonly pending = new Set<Promise<void>>();
    private readonly pendingErrors: unknown[] = [];
    private readonly gatewayDecoders = new Map<string, GatewayZlibStreamDecoder>();
    private readonly dynamicFixtureScopeIds = new Set<string>();
    private rateLimitResponses = 0;
    private abortRaised = false;
    private stepStack: string[] = [];
    private lastEmittedTimestampMs = 0;

    constructor(options: CdpNetworkRecorderOptions) {
        this.cdp = options.cdp;
        this.runId = options.runId;
        this.feature = options.feature;
        this.fixtures = options.fixtures;
        this.routeCatalog = options.routeCatalog ?? [];
        this.onEvent = options.onEvent;
        this.bypassServiceWorker = options.bypassServiceWorker ?? true;
        this.enforceFixtureScope = options.enforceFixtureScope ?? false;
        this.safetyGates = { ...defaultSafetyGates, ...options.safetyGates };
    }

    async start(): Promise<void> {
        await this.cdp.send("Network.enable");
        if (this.bypassServiceWorker) {
            await this.cdp.send("Network.setBypassServiceWorker", { bypass: true });
        }

        this.cdp.on("Network.requestWillBeSent", (payload) => {
            this.enqueue(this.handleRequestWillBeSent(payload));
        });
        this.cdp.on("Network.requestWillBeSentExtraInfo", (payload) => {
            this.enqueue(this.handleRequestWillBeSentExtraInfo(payload));
        });
        this.cdp.on("Network.responseReceived", (payload) => {
            this.handleResponseReceived(payload);
        });
        this.cdp.on("Network.responseReceivedExtraInfo", (payload) => {
            this.enqueue(this.handleResponseReceivedExtraInfo(payload));
        });
        this.cdp.on("Network.loadingFinished", (payload) => {
            this.enqueue(this.handleLoadingFinished(payload));
        });
        this.cdp.on("Network.loadingFailed", (payload) => {
            this.enqueue(this.handleLoadingFailed(payload));
        });
        this.cdp.on("Network.webSocketCreated", (payload) => {
            this.enqueue(this.handleWebSocketCreated(payload));
        });
        this.cdp.on("Network.webSocketWillSendHandshakeRequest", (payload) => {
            this.enqueue(this.handleWebSocketHandshakeRequest(payload));
        });
        this.cdp.on("Network.webSocketHandshakeResponseReceived", (payload) => {
            this.enqueue(this.handleWebSocketHandshakeResponse(payload));
        });
        this.cdp.on("Network.webSocketFrameSent", (payload) => {
            this.enqueue(this.handleWebSocketFrame(payload, "sent"));
        });
        this.cdp.on("Network.webSocketFrameReceived", (payload) => {
            this.enqueue(this.handleWebSocketFrame(payload, "received"));
        });
        this.cdp.on("Network.webSocketFrameError", (payload) => {
            this.enqueue(this.handleWebSocketError(payload));
        });
        this.cdp.on("Network.webSocketClosed", (payload) => {
            this.enqueue(this.handleWebSocketClosed(payload));
        });
    }

    async flush(): Promise<void> {
        while (this.pending.size > 0) {
            await Promise.all(Array.from(this.pending));
        }
        for (const decoder of this.gatewayDecoders.values()) {
            decoder.close();
        }
        this.gatewayDecoders.clear();
        const error = this.pendingErrors.shift();
        if (error) {
            throw error;
        }
    }

    async step<T>(stepId: string, title: string, run: () => Promise<T>): Promise<T> {
        this.stepStack.push(stepId);
        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: stepId,
            ts_monotonic_ms: nowMs(),
            kind: "step.start",
            title,
        });

        try {
            return await run();
        } finally {
            await this.emit({
                run_id: this.runId,
                feature_id: this.feature.id,
                step_id: stepId,
                ts_monotonic_ms: nowMs(),
                kind: "step.end",
                title,
            });
            this.stepStack.pop();
        }
    }

    async action(action: UiActionDetails): Promise<void> {
        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: this.currentStep(),
            ts_monotonic_ms: nowMs(),
            kind: "ui.action",
            ...action,
        });
    }

    private async handleRequestWillBeSent(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        const request = isRecord(payload.request) ? payload.request : undefined;
        const method = stringField(request?.method) ?? "GET";
        const url = stringField(request?.url);
        if (!requestId || !url || !isHttpApiUrl(url)) {
            return;
        }
        this.rememberDynamicFixtureScopeIds(url);
        if (this.enforceFixtureScope) {
            assertFixtureUrlScope(url, this.fixtures, { allowedIds: this.dynamicFixtureScopeIds });
        }

        const normalized = normalizeUrl(url, { fixtures: this.fixtures });
        const route = this.matchRoute(method, normalized.normalized_route);
        const state: RequestState = {
            method,
            url,
            normalized_route: normalized.normalized_route,
            route_name: route?.route_name,
            step_id: this.currentStep(),
            request_headers_redacted: redactHeaders(headersFromUnknown(request?.headers), { fixtures: this.fixtures }),
        };
        this.requests.set(requestId, state);

        const postData = stringField(request?.postData) ?? (await this.getRequestPostData(requestId));
        const body = postData ? redactedBodyFromText(postData, this.fixtures) : undefined;
        const bodyShape = typeof body === "undefined" ? undefined : shapeResult(body);
        const initiator = isRecord(payload.initiator) ? payload.initiator : undefined;
        const frames = initiator ? initiatorStackFrames(initiator, this.fixtures) : undefined;
        const stackHash = initiator
            ? hashJson({
                  type: stringField(initiator.type),
                  frames,
              })
            : undefined;

        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: state.step_id,
            ts_monotonic_ms: timestampMs(payload.timestamp),
            kind: "http.request",
            cdp_request_id: requestId,
            method: method as HttpMethod,
            url: redactText(url, { fixtures: this.fixtures }),
            normalized_route: normalized.normalized_route,
            route_name: route?.route_name,
            headers_redacted: true,
            request_headers_redacted: state.request_headers_redacted,
            request_body_shape_hash: bodyShape?.hash,
            request_body_shape: bodyShape?.shape,
            request_body_redacted: body,
            initiator: {
                type: stringField(initiator?.type),
                stack_hash: stackHash,
                frames,
            },
        });
    }

    private rememberDynamicFixtureScopeIds(url: string): void {
        const parts = pathPartsFromUrl(url);
        const apiStart = parts[0] === "api" && /^v\d+$/.test(parts[1] ?? "") ? 2 : 0;
        const routeParts = parts.slice(apiStart);
        const [channelsLiteral, channelId, messagesLiteral, messageId, threadsLiteral] = routeParts;
        if (channelsLiteral !== "channels" || messagesLiteral !== "messages" || threadsLiteral !== "threads" || !channelId || !messageId) {
            return;
        }
        if (!flattenFixtureIds(this.fixtures).has(channelId)) {
            return;
        }

        this.dynamicFixtureScopeIds.add(messageId);
    }

    private async handleRequestWillBeSentExtraInfo(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        if (!requestId) {
            return;
        }

        const state = this.requests.get(requestId);
        const headers = redactHeaders(headersFromUnknown(payload.headers), { fixtures: this.fixtures });
        this.requests.set(requestId, {
            ...state,
            request_headers_redacted: headers,
        });

        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: state?.step_id ?? this.currentStep(),
            ts_monotonic_ms: nowMs(),
            kind: "http.request.extra_info",
            cdp_request_id: requestId,
            headers_redacted: true,
            request_headers_redacted: headers,
        });
    }

    private handleResponseReceived(payload: Record<string, unknown>): void {
        const requestId = stringField(payload.requestId);
        const response = isRecord(payload.response) ? payload.response : undefined;
        const url = stringField(response?.url);
        if (!requestId || !url || !isHttpApiUrl(url)) {
            return;
        }

        const normalized = normalizeUrl(url, { fixtures: this.fixtures });
        const existing = this.requests.get(requestId) ?? {};
        this.requests.set(requestId, {
            ...existing,
            url,
            normalized_route: normalized.normalized_route,
            route_name: this.matchRoute(existing.method ?? "GET", normalized.normalized_route)?.route_name,
            status: numberField(response?.status),
            response_headers_redacted: redactHeaders(headersFromUnknown(response?.headers), { fixtures: this.fixtures }),
        });
    }

    private async handleResponseReceivedExtraInfo(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        if (!requestId) {
            return;
        }

        const state = this.requests.get(requestId);
        const headers = redactHeaders(headersFromUnknown(payload.headers), { fixtures: this.fixtures });
        this.requests.set(requestId, {
            ...state,
            status: numberField(payload.statusCode) ?? state?.status,
            response_headers_redacted: headers,
        });

        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: state?.step_id ?? this.currentStep(),
            ts_monotonic_ms: nowMs(),
            kind: "http.response.extra_info",
            cdp_request_id: requestId,
            headers_redacted: true,
            response_headers_redacted: headers,
            status: numberField(payload.statusCode),
        });
        await this.maybeAbortForRateLimit({
            requestId,
            state,
            status: numberField(payload.statusCode),
            timestamp: nowMs(),
        });
    }

    private async handleLoadingFinished(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        if (!requestId) {
            return;
        }

        const state = this.requests.get(requestId);
        if (!state?.url || !state.normalized_route) {
            return;
        }

        const body = await this.getResponseBody(requestId);
        const response = body ? redactedBodyFromText(body, this.fixtures) : undefined;
        const responseShape = typeof response === "undefined" ? undefined : shapeResult(response);
        const safetySignal = body ? safetySignalFromResponseBody(body) : undefined;

        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: state.step_id ?? this.currentStep(),
            ts_monotonic_ms: timestampMs(payload.timestamp),
            kind: "http.response",
            cdp_request_id: requestId,
            method: state.method as HttpMethod | undefined,
            url: redactText(state.url, { fixtures: this.fixtures }),
            normalized_route: state.normalized_route,
            route_name: state.route_name,
            status: state.status ?? 0,
            headers_redacted: true,
            response_headers_redacted: state.response_headers_redacted,
            response_body_shape_hash: responseShape?.hash,
            response_body_shape: responseShape?.shape,
            response_body_redacted: response,
        });

        await this.maybeAbortForRateLimit({
            requestId,
            state,
            status: state.status,
            timestamp: timestampMs(payload.timestamp),
            retryAfterMs: retryAfterMsFromResponseBody(body),
        });
        await this.maybeAbortForBodySignal({
            requestId,
            state,
            status: state.status,
            timestamp: timestampMs(payload.timestamp),
            safetySignal,
        });

        this.requests.delete(requestId);
    }

    private async maybeAbortForRateLimit(options: { requestId: string; state?: RequestState; status?: number; timestamp: number; retryAfterMs?: number }): Promise<void> {
        if (options.status !== 429 || this.abortRaised) {
            return;
        }
        if (!shouldAbortForRateLimit(options.state)) {
            return;
        }

        this.rateLimitResponses += 1;
        if (this.rateLimitResponses <= this.safetyGates.maxRateLimitResponses) {
            return;
        }

        await this.abortCapture({
            reason: "rate_limited",
            message: `Observed ${this.rateLimitResponses} HTTP 429 response(s); aborting capture to avoid unsafe retry behavior`,
            requestId: options.requestId,
            state: options.state,
            status: options.status,
            timestamp: options.timestamp,
            retryAfterMs: options.retryAfterMs,
        });
    }

    private async maybeAbortForBodySignal(options: {
        requestId: string;
        state?: RequestState;
        status?: number;
        timestamp: number;
        safetySignal?: RuntimeSafetySignal;
    }): Promise<void> {
        if (!options.safetySignal || this.abortRaised) {
            return;
        }
        if (options.safetySignal.reason === "captcha" && !this.safetyGates.abortOnCaptcha) {
            return;
        }
        if (options.safetySignal.reason === "checkpoint" && !this.safetyGates.abortOnCheckpoint) {
            return;
        }

        await this.abortCapture({
            reason: options.safetySignal.reason,
            message: options.safetySignal.message,
            requestId: options.requestId,
            state: options.state,
            status: options.status,
            timestamp: options.timestamp,
        });
    }

    private async abortCapture(options: {
        reason: RuntimeAbortReason;
        message: string;
        requestId: string;
        state?: RequestState;
        status?: number;
        timestamp: number;
        retryAfterMs?: number;
    }): Promise<never> {
        this.abortRaised = true;
        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: options.state?.step_id ?? this.currentStep(),
            ts_monotonic_ms: options.timestamp,
            kind: "runtime.abort",
            reason: options.reason,
            message: options.message,
            quarantine: true,
            cdp_request_id: options.requestId,
            url: options.state?.url ? redactText(options.state.url, { fixtures: this.fixtures }) : undefined,
            normalized_route: options.state?.normalized_route,
            status: options.status,
            retry_after_ms: options.retryAfterMs,
        });
        throw new CaptureAbortError(options.reason, options.message);
    }

    private async handleLoadingFailed(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        if (!requestId) {
            return;
        }

        const state = this.requests.get(requestId);
        if (!state?.url || !state.normalized_route) {
            return;
        }
        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: state?.step_id ?? this.currentStep(),
            ts_monotonic_ms: timestampMs(payload.timestamp),
            kind: "http.failure",
            cdp_request_id: requestId,
            url: state?.url ? redactText(state.url, { fixtures: this.fixtures }) : undefined,
            normalized_route: state?.normalized_route,
            error_text: stringField(payload.errorText),
        });
        this.requests.delete(requestId);
    }

    private async handleWebSocketCreated(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        const url = stringField(payload.url);
        if (!requestId || !url) {
            return;
        }

        this.sockets.set(requestId, url);
        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: this.currentStep(),
            ts_monotonic_ms: timestampMs(payload.timestamp),
            kind: "ws.created",
            websocket_id: requestId,
            url: redactText(url, { fixtures: this.fixtures }),
        });
    }

    private async handleWebSocketHandshakeRequest(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        const request = isRecord(payload.request) ? payload.request : undefined;
        if (!requestId) {
            return;
        }

        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: this.currentStep(),
            ts_monotonic_ms: timestampMs(payload.timestamp),
            kind: "ws.handshake.request",
            websocket_id: requestId,
            url: redactText(this.sockets.get(requestId) ?? "", { fixtures: this.fixtures }),
            headers_redacted: true,
            request_headers_redacted: redactHeaders(headersFromUnknown(request?.headers), { fixtures: this.fixtures }),
        });
    }

    private async handleWebSocketHandshakeResponse(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        const response = isRecord(payload.response) ? payload.response : undefined;
        if (!requestId) {
            return;
        }

        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: this.currentStep(),
            ts_monotonic_ms: timestampMs(payload.timestamp),
            kind: "ws.handshake.response",
            websocket_id: requestId,
            url: redactText(this.sockets.get(requestId) ?? "", { fixtures: this.fixtures }),
            headers_redacted: true,
            response_headers_redacted: redactHeaders(headersFromUnknown(response?.headers), { fixtures: this.fixtures }),
            status: numberField(response?.status),
            status_text: stringField(response?.statusText),
        });
    }

    private async handleWebSocketFrame(payload: Record<string, unknown>, direction: "sent" | "received"): Promise<void> {
        const requestId = stringField(payload.requestId);
        const response = isRecord(payload.response) ? payload.response : undefined;
        const payloadData = stringField(response?.payloadData);
        if (!requestId || typeof payloadData === "undefined") {
            return;
        }

        const frameOpcode = numberField(response?.opcode);
        const decodedPayload = await this.decodeGatewayPayload(requestId, payloadData, frameOpcode);
        const parsed = typeof decodedPayload === "undefined" ? undefined : tryParseJson(decodedPayload);
        const redacted =
            typeof decodedPayload === "undefined"
                ? "{binary_frame}"
                : typeof parsed === "undefined"
                  ? redactText(decodedPayload, { fixtures: this.fixtures })
                  : redactJsonValue(parsed, { fixtures: this.fixtures });
        const payloadShape = shapeResult(redacted);
        const gatewayEnvelope = isRecord(parsed) ? parsed : undefined;

        const event: WebSocketFrameEvent = {
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: this.currentStep(),
            ts_monotonic_ms: timestampMs(payload.timestamp),
            kind: direction === "sent" ? "ws.frame.sent" : "ws.frame.received",
            websocket_id: requestId,
            url: redactText(this.sockets.get(requestId) ?? "", { fixtures: this.fixtures }),
            direction,
            opcode: numberField(gatewayEnvelope?.op) ?? frameOpcode,
            gateway_event: stringField(gatewayEnvelope?.t),
            sequence: numberField(gatewayEnvelope?.s),
            payload_shape_hash: payloadShape.hash,
            payload_shape: payloadShape.shape,
            payload_redacted: redacted,
        };

        await this.emit(event);
    }

    private async decodeGatewayPayload(requestId: string, payloadData: string, frameOpcode: number | undefined): Promise<string | undefined> {
        if (frameOpcode !== 2) {
            return payloadData;
        }

        let decoder = this.gatewayDecoders.get(requestId);
        if (!decoder) {
            decoder = new GatewayZlibStreamDecoder();
            this.gatewayDecoders.set(requestId, decoder);
        }

        return decoder.decodeBase64(payloadData);
    }

    private async handleWebSocketError(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        if (!requestId) {
            return;
        }

        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: this.currentStep(),
            ts_monotonic_ms: timestampMs(payload.timestamp),
            kind: "ws.error",
            websocket_id: requestId,
            url: redactText(this.sockets.get(requestId) ?? "", { fixtures: this.fixtures }),
            error_text: stringField(payload.errorMessage),
        });
    }

    private async handleWebSocketClosed(payload: Record<string, unknown>): Promise<void> {
        const requestId = stringField(payload.requestId);
        if (!requestId) {
            return;
        }

        await this.emit({
            run_id: this.runId,
            feature_id: this.feature.id,
            step_id: this.currentStep(),
            ts_monotonic_ms: timestampMs(payload.timestamp),
            kind: "ws.closed",
            websocket_id: requestId,
            url: redactText(this.sockets.get(requestId) ?? "", { fixtures: this.fixtures }),
        });
        this.sockets.delete(requestId);
    }

    private async getRequestPostData(requestId: string): Promise<string | undefined> {
        try {
            const result = await this.cdp.send("Network.getRequestPostData", { requestId });
            return isRecord(result) ? stringField(result.postData) : undefined;
        } catch {
            return undefined;
        }
    }

    private async getResponseBody(requestId: string): Promise<string | undefined> {
        try {
            const result = await this.cdp.send("Network.getResponseBody", { requestId });
            return isRecord(result) ? stringField(result.body) : undefined;
        } catch {
            return undefined;
        }
    }

    private matchRoute(method: string, route: string): RouteCatalogEntry | undefined {
        return this.routeCatalog.find((entry) => entry.method === method.toUpperCase() && entry.route === route);
    }

    private currentStep(): string | undefined {
        return this.stepStack.at(-1);
    }

    private async emit(event: CaptureEvent): Promise<void> {
        const timestampedEvent = this.withMonotonicTimestamp(event);
        await this.onEvent(timestampedEvent);
    }

    private enqueue(work: Promise<void>): void {
        const pendingWork = work
            .catch((error: unknown) => {
                this.pendingErrors.push(error);
            })
            .finally(() => {
                this.pending.delete(pendingWork);
            });
        this.pending.add(pendingWork);
    }

    private withMonotonicTimestamp(event: CaptureEvent): CaptureEvent {
        if (event.ts_monotonic_ms >= this.lastEmittedTimestampMs) {
            this.lastEmittedTimestampMs = event.ts_monotonic_ms;
            return event;
        }

        this.lastEmittedTimestampMs += 0.001;
        return {
            ...event,
            ts_monotonic_ms: this.lastEmittedTimestampMs,
        } as CaptureEvent;
    }
}

interface RuntimeSafetySignal {
    reason: Exclude<RuntimeAbortReason, "rate_limited">;
    message: string;
}

function redactedBodyFromText(text: string, fixtures?: FixtureManifest): unknown {
    const parsed = tryParseJson(text);
    if (typeof parsed === "undefined") {
        return redactText(text, { fixtures });
    }

    return redactJsonValue(parsed, { fixtures });
}

function shouldAbortForRateLimit(state: RequestState | undefined): boolean {
    const method = state?.method?.toUpperCase();
    return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function isHttpApiUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.pathname.startsWith("/api/");
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

function headersFromUnknown(value: unknown): Record<string, string | string[] | undefined> {
    if (!isRecord(value)) {
        return {};
    }

    const headers: Record<string, string | string[] | undefined> = {};
    for (const [key, child] of Object.entries(value)) {
        if (typeof child === "string") {
            headers[key] = child;
        } else if (Array.isArray(child)) {
            headers[key] = child.filter((item): item is string => typeof item === "string");
        }
    }

    return headers;
}

function initiatorStackFrames(initiator: Record<string, unknown>, fixtures?: FixtureManifest): InitiatorStackFrame[] | undefined {
    const frames: InitiatorStackFrame[] = [];
    collectInitiatorFrames(initiator.stack, frames, fixtures);
    return frames.length > 0 ? frames.slice(0, 50) : undefined;
}

function collectInitiatorFrames(value: unknown, frames: InitiatorStackFrame[], fixtures?: FixtureManifest): void {
    if (!isRecord(value)) {
        return;
    }

    const callFrames = Array.isArray(value.callFrames) ? value.callFrames : [];
    for (const frame of callFrames) {
        if (!isRecord(frame)) {
            continue;
        }

        const url = stringField(frame.url);
        if (!url) {
            continue;
        }

        const sanitizedUrl = sanitizeInitiatorUrl(url, fixtures);
        frames.push({
            url: sanitizedUrl,
            file_name: fileNameFromSanitizedUrl(sanitizedUrl),
            function_name: sanitizeFunctionName(stringField(frame.functionName), fixtures),
            line_number: numberField(frame.lineNumber),
            column_number: numberField(frame.columnNumber),
        });
    }

    collectInitiatorFrames(value.parent, frames, fixtures);
}

function sanitizeFunctionName(value: string | undefined, fixtures?: FixtureManifest): string | undefined {
    if (!value) {
        return undefined;
    }

    const redacted = redactText(value, { fixtures });
    return redacted.length > 0 ? redacted.slice(0, 160) : undefined;
}

function sanitizeInitiatorUrl(value: string, fixtures?: FixtureManifest): string {
    try {
        const url = new URL(value);
        url.search = "";
        url.hash = "";
        return redactText(url.toString(), { fixtures });
    } catch {
        return redactText(value.split(/[?#]/, 1)[0] ?? value, { fixtures });
    }
}

function fileNameFromSanitizedUrl(value: string): string | undefined {
    try {
        const fileName = new URL(value).pathname.split("/").filter(Boolean).at(-1);
        return fileName ? fileName.slice(0, 160) : undefined;
    } catch {
        return undefined;
    }
}

function pathPartsFromUrl(value: string): string[] {
    try {
        return new URL(value).pathname.split("/").filter(Boolean);
    } catch {
        return value.split(/[?#]/, 1)[0]?.split("/").filter(Boolean) ?? [];
    }
}

function safetySignalFromResponseBody(text: string): RuntimeSafetySignal | undefined {
    const parsed = tryParseJson(text);
    const value = typeof parsed === "undefined" ? text : parsed;
    if (containsKeyOrString(value, /captcha/i)) {
        return {
            reason: "captcha",
            message: "Observed CAPTCHA challenge material in an API response; aborting capture for manual review",
        };
    }
    if (containsKeyOrString(value, /(checkpoint|required_action|verify_email|verify_phone|account_standing)/i)) {
        return {
            reason: "checkpoint",
            message: "Observed account checkpoint material in an API response; aborting capture for manual review",
        };
    }

    return undefined;
}

function retryAfterMsFromResponseBody(text: string | undefined): number | undefined {
    if (!text) {
        return undefined;
    }

    const parsed = tryParseJson(text);
    if (!isRecord(parsed)) {
        return undefined;
    }

    const retryAfter = parsed.retry_after;
    if (typeof retryAfter === "number") {
        return Math.round(retryAfter * 1000);
    }
    if (typeof retryAfter === "string") {
        const parsedRetryAfter = Number(retryAfter);
        return Number.isFinite(parsedRetryAfter) ? Math.round(parsedRetryAfter * 1000) : undefined;
    }

    return undefined;
}

function containsKeyOrString(value: unknown, pattern: RegExp): boolean {
    if (typeof value === "string") {
        return pattern.test(value);
    }
    if (Array.isArray(value)) {
        return value.some((item) => containsKeyOrString(item, pattern));
    }
    if (!isRecord(value)) {
        return false;
    }

    return Object.entries(value).some(([key, child]) => pattern.test(key) || containsKeyOrString(child, pattern));
}

function timestampMs(value: unknown): number {
    return typeof value === "number" ? value * 1000 : nowMs();
}

function nowMs(): number {
    return performance.now();
}
