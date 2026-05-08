import { FixtureManifest } from "../fixtures/manifest.js";
import { CaptureEvent, FeatureDefinition, HttpMethod, RouteCatalogEntry, WebSocketFrameEvent } from "../types.js";
import { hashJson } from "../util/hash.js";
import { isRecord, tryParseJson } from "../util/json.js";
import { normalizeUrl } from "./normalize.js";
import { redactHeaders, redactJsonValue, redactText } from "./redact.js";
import { shapeResult } from "./shape.js";

export interface MitmproxyImportOptions {
    runId: string;
    feature: Pick<FeatureDefinition, "id">;
    fixtures?: FixtureManifest;
    routeCatalog?: RouteCatalogEntry[];
    defaultStepId?: string;
}

export interface MitmproxyImportSummary {
    flows_seen: number;
    flows_with_events: number;
    flows_skipped: number;
    events: number;
    http_requests: number;
    http_responses: number;
    websocket_frames: number;
}

export interface MitmproxyImportResult {
    events: CaptureEvent[];
    summary: MitmproxyImportSummary;
}

interface PendingEvent {
    source_time_ms?: number;
    event: CaptureEvent;
}

export function importMitmproxyFlowEvents(input: unknown, options: MitmproxyImportOptions): MitmproxyImportResult {
    const flows = mitmproxyFlowRecords(input);
    const pending: PendingEvent[] = [];
    let flowsWithEvents = 0;

    flows.forEach((flow, index) => {
        const countBefore = pending.length;
        importHttpFlow(flow, index, options, pending);
        importWebSocketFlow(flow, index, options, pending);
        if (pending.length > countBefore) {
            flowsWithEvents += 1;
        }
    });

    const events = finalizeEventTimes(pending);
    const counts = countImportedEvents(events);
    return {
        events,
        summary: {
            flows_seen: flows.length,
            flows_with_events: flowsWithEvents,
            flows_skipped: flows.length - flowsWithEvents,
            events: events.length,
            http_requests: counts["http.request"] ?? 0,
            http_responses: counts["http.response"] ?? 0,
            websocket_frames: (counts["ws.frame.sent"] ?? 0) + (counts["ws.frame.received"] ?? 0),
        },
    };
}

function mitmproxyFlowRecords(input: unknown): Record<string, unknown>[] {
    if (Array.isArray(input)) {
        return input.filter(isRecord);
    }
    if (isRecord(input) && Array.isArray(input.flows)) {
        return input.flows.filter(isRecord);
    }
    return [];
}

function importHttpFlow(flow: Record<string, unknown>, index: number, options: MitmproxyImportOptions, pending: PendingEvent[]): void {
    const request = isRecord(flow.request) ? flow.request : undefined;
    const url = stringField(request?.url) ?? stringField(request?.pretty_url) ?? urlFromParts(request);
    if (!request || !url || !isDiscordHttpApiUrl(url)) {
        return;
    }

    const method = (stringField(request.method) ?? "GET").toUpperCase() as HttpMethod;
    const normalized = normalizeUrl(url, { fixtures: options.fixtures });
    const route = options.routeCatalog?.find((entry) => entry.method === method && entry.route === normalized.normalized_route);
    const requestBody = redactedBodyFromRecord(request, options.fixtures);
    const requestShape = typeof requestBody === "undefined" ? undefined : shapeResult(requestBody);
    const cdpRequestId = mitmproxyRequestId(flow, index);

    pending.push({
        source_time_ms: timestampMs(request.timestamp_start ?? flow.timestamp_start),
        event: {
            run_id: options.runId,
            feature_id: options.feature.id,
            step_id: options.defaultStepId,
            ts_monotonic_ms: 0,
            kind: "http.request",
            cdp_request_id: cdpRequestId,
            method,
            url: redactText(normalized.normalized_url, { fixtures: options.fixtures }),
            normalized_route: normalized.normalized_route,
            route_name: route?.route_name,
            headers_redacted: true,
            request_headers_redacted: redactHeaders(headersFromUnknown(request.headers), { fixtures: options.fixtures }),
            request_body_shape_hash: requestShape?.hash,
            request_body_shape: requestShape?.shape,
            request_body_redacted: requestBody,
            initiator: {
                type: "mitmproxy",
                stack_hash: hashJson({ source: "mitmproxy", flow_id: cdpRequestId }),
            },
        },
    });

    const response = isRecord(flow.response) ? flow.response : undefined;
    if (!response) {
        return;
    }

    const responseBody = redactedBodyFromRecord(response, options.fixtures);
    const responseShape = typeof responseBody === "undefined" ? undefined : shapeResult(responseBody);
    pending.push({
        source_time_ms: timestampMs(response.timestamp_end ?? response.timestamp_start ?? flow.timestamp_end),
        event: {
            run_id: options.runId,
            feature_id: options.feature.id,
            step_id: options.defaultStepId,
            ts_monotonic_ms: 0,
            kind: "http.response",
            cdp_request_id: cdpRequestId,
            method,
            url: redactText(normalized.normalized_url, { fixtures: options.fixtures }),
            normalized_route: normalized.normalized_route,
            route_name: route?.route_name,
            status: statusCode(response),
            headers_redacted: true,
            response_headers_redacted: redactHeaders(headersFromUnknown(response.headers), { fixtures: options.fixtures }),
            response_body_shape_hash: responseShape?.hash,
            response_body_shape: responseShape?.shape,
            response_body_redacted: responseBody,
        },
    });
}

function importWebSocketFlow(flow: Record<string, unknown>, index: number, options: MitmproxyImportOptions, pending: PendingEvent[]): void {
    const websocket = isRecord(flow.websocket) ? flow.websocket : undefined;
    const messages = Array.isArray(websocket?.messages) ? websocket.messages : Array.isArray(flow.websocket_messages) ? flow.websocket_messages : [];
    if (messages.length === 0) {
        return;
    }

    const request = isRecord(flow.request) ? flow.request : undefined;
    const url = stringField(websocket?.url) ?? stringField(request?.url) ?? urlFromParts(request);
    if (!url || !isDiscordWebSocketUrl(url)) {
        return;
    }

    const websocketId = mitmproxyRequestId(flow, index);
    const redactedUrl = sanitizeWebSocketUrl(url, options.fixtures);
    pending.push({
        source_time_ms: timestampMs(request?.timestamp_start ?? flow.timestamp_start),
        event: {
            run_id: options.runId,
            feature_id: options.feature.id,
            step_id: options.defaultStepId,
            ts_monotonic_ms: 0,
            kind: "ws.created",
            websocket_id: websocketId,
            url: redactedUrl,
        },
    });

    for (const message of messages) {
        if (!isRecord(message)) {
            continue;
        }
        const direction = directionFromMessage(message);
        if (!direction) {
            continue;
        }
        const payload = payloadFromMessage(message, options.fixtures);
        const payloadShape = typeof payload === "undefined" ? undefined : shapeResult(payload);
        const envelope = isRecord(tryParseJson(bodyTextFromRecord(message) ?? "")) ? (tryParseJson(bodyTextFromRecord(message) ?? "") as Record<string, unknown>) : undefined;
        const event: WebSocketFrameEvent = {
            run_id: options.runId,
            feature_id: options.feature.id,
            step_id: options.defaultStepId,
            ts_monotonic_ms: 0,
            kind: direction === "sent" ? "ws.frame.sent" : "ws.frame.received",
            websocket_id: websocketId,
            url: redactedUrl,
            direction,
            opcode: numberField(envelope?.op) ?? numberField(message.opcode),
            gateway_event: stringField(envelope?.t),
            sequence: numberField(envelope?.s),
            payload_shape_hash: payloadShape?.hash,
            payload_shape: payloadShape?.shape,
            payload_redacted: payload,
        };
        pending.push({
            source_time_ms: timestampMs(message.timestamp ?? message.timestamp_start),
            event,
        });
    }
}

function finalizeEventTimes(pending: PendingEvent[]): CaptureEvent[] {
    const finiteTimes = pending.map((entry) => entry.source_time_ms).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const baseTime = finiteTimes.length > 0 ? Math.min(...finiteTimes) : 0;
    return pending
        .map((entry, index) => ({
            ...entry.event,
            ts_monotonic_ms:
                typeof entry.source_time_ms === "number" && Number.isFinite(entry.source_time_ms)
                    ? Math.max(0, Math.round((entry.source_time_ms - baseTime) * 1000) / 1000)
                    : index,
        }))
        .sort((left, right) => left.ts_monotonic_ms - right.ts_monotonic_ms);
}

function countImportedEvents(events: CaptureEvent[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of events) {
        counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    }
    return counts;
}

function mitmproxyRequestId(flow: Record<string, unknown>, index: number): string {
    return `mitmproxy:${stringField(flow.id) ?? stringField(flow.uuid) ?? index}`;
}

function redactedBodyFromRecord(record: Record<string, unknown>, fixtures?: FixtureManifest): unknown {
    const directJson = record.json ?? record.decoded_content_json;
    if (typeof directJson !== "undefined") {
        return redactJsonValue(directJson, { fixtures });
    }
    const text = bodyTextFromRecord(record);
    if (typeof text === "undefined" || text.length === 0) {
        return undefined;
    }
    const parsed = tryParseJson(text);
    return typeof parsed === "undefined" ? redactText(text, { fixtures }) : redactJsonValue(parsed, { fixtures });
}

function payloadFromMessage(message: Record<string, unknown>, fixtures?: FixtureManifest): unknown {
    const text = bodyTextFromRecord(message);
    if (typeof text === "undefined") {
        return undefined;
    }
    const parsed = tryParseJson(text);
    return typeof parsed === "undefined" ? redactText(text, { fixtures }) : redactJsonValue(parsed, { fixtures });
}

function bodyTextFromRecord(record: Record<string, unknown>): string | undefined {
    for (const key of ["text", "content", "body", "payload", "data"]) {
        const value = record[key];
        if (typeof value === "string") {
            return value;
        }
        if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
            return Buffer.from(value).toString("utf8");
        }
    }
    const base64 = stringField(record.raw_content_base64) ?? stringField(record.content_base64);
    if (base64) {
        return Buffer.from(base64, "base64").toString("utf8");
    }
    return undefined;
}

function urlFromParts(request: Record<string, unknown> | undefined): string | undefined {
    if (!request) {
        return undefined;
    }
    const scheme = stringField(request.scheme) ?? "https";
    const host = stringField(request.host) ?? stringField(request.pretty_host);
    const path = stringField(request.path) ?? "/";
    const port = numberField(request.port);
    if (!host) {
        return undefined;
    }
    const portSuffix = port && ![80, 443].includes(port) ? `:${port}` : "";
    return `${scheme}://${host}${portSuffix}${path}`;
}

function headersFromUnknown(value: unknown): Record<string, string | string[] | undefined> {
    if (isRecord(value) && Array.isArray(value.fields)) {
        return headersFromUnknown(value.fields);
    }
    if (Array.isArray(value)) {
        const output: Record<string, string | string[] | undefined> = {};
        for (const header of value) {
            if (Array.isArray(header) && typeof header[0] === "string" && typeof header[1] === "string") {
                output[header[0]] = appendHeader(output[header[0]], header[1]);
            } else if (isRecord(header)) {
                const name = stringField(header.name) ?? stringField(header[0]);
                const headerValue = stringField(header.value) ?? stringField(header[1]);
                if (name && typeof headerValue === "string") {
                    output[name] = appendHeader(output[name], headerValue);
                }
            }
        }
        return output;
    }
    if (!isRecord(value)) {
        return {};
    }

    const output: Record<string, string | string[] | undefined> = {};
    for (const [key, child] of Object.entries(value)) {
        if (typeof child === "string") {
            output[key] = child;
        } else if (Array.isArray(child)) {
            output[key] = child.filter((item): item is string => typeof item === "string");
        }
    }
    return output;
}

function appendHeader(existing: string | string[] | undefined, value: string): string | string[] {
    if (typeof existing === "undefined") {
        return value;
    }
    return Array.isArray(existing) ? [...existing, value] : [existing, value];
}

function directionFromMessage(message: Record<string, unknown>): "sent" | "received" | undefined {
    if (typeof message.from_client === "boolean") {
        return message.from_client ? "sent" : "received";
    }
    const value = (stringField(message.direction) ?? stringField(message.sender) ?? stringField(message.type) ?? "").toLowerCase();
    if (["sent", "send", "client", "from_client", "outgoing"].some((candidate) => value.includes(candidate))) {
        return "sent";
    }
    if (["received", "receive", "server", "from_server", "incoming"].some((candidate) => value.includes(candidate))) {
        return "received";
    }
    return undefined;
}

function statusCode(response: Record<string, unknown>): number {
    return numberField(response.status_code) ?? numberField(response.status) ?? 0;
}

function timestampMs(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return undefined;
    }
    return value > 1_000_000_000_000 ? value : value * 1000;
}

function isDiscordHttpApiUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return discordHttpHosts.has(parsed.hostname) && parsed.pathname.startsWith("/api/");
    } catch {
        return false;
    }
}

function isDiscordWebSocketUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "wss:" && parsed.hostname === "gateway.discord.gg";
    } catch {
        return false;
    }
}

function sanitizeWebSocketUrl(input: string, fixtures?: FixtureManifest): string {
    const parsed = new URL(input);
    const queryKeys = Array.from(parsed.searchParams.keys()).sort();
    const query = queryKeys.length > 0 ? `?${queryKeys.map((key) => `${key}={query}`).join("&")}` : "";
    return redactText(`${parsed.protocol}//${parsed.hostname}${parsed.pathname}${query}`, { fixtures });
}

const discordHttpHosts = new Set(["discord.com", "canary.discord.com", "ptb.discord.com"]);

function stringField(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function numberField(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
}
