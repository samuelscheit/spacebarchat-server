import {
    Attribution,
    CaptureEvent,
    FeatureActionSummary,
    FeatureDefinition,
    FeatureStepSummary,
    FeatureSummary,
    HttpRequestEvent,
    HttpResponseEvent,
    TrafficSummaryItem,
    WebSocketFrameEvent,
} from "../types.js";

type HttpSummaryEvent = HttpRequestEvent | HttpResponseEvent | Extract<CaptureEvent, { kind: "playwright.http.request" | "playwright.http.response" }>;
type HttpRequestSummaryEvent = HttpRequestEvent | Extract<CaptureEvent, { kind: "playwright.http.request" }>;
type HttpResponseSummaryEvent = HttpResponseEvent | Extract<CaptureEvent, { kind: "playwright.http.response" }>;
type GatewaySummaryEvent = WebSocketFrameEvent | Extract<CaptureEvent, { kind: "playwright.ws.frame.sent" | "playwright.ws.frame.received" }>;

export interface CorrelateOptions {
    feature: FeatureDefinition;
    events: CaptureEvent[];
    baselineEvents?: CaptureEvent[];
}

export function correlateFeatureTraffic(options: CorrelateOptions): FeatureSummary {
    const baseline = options.baselineEvents ?? [];
    const steps = stepWindows(options.events);
    const timingMaterialEvents = actionTimingMaterialEvents(options.events);
    const items = new Map<string, TrafficSummaryItem>();
    let unknownEvents = 0;
    let backgroundEvents = 0;

    for (const event of options.events) {
        const eventStepId = "step_id" in event ? (event.step_id ?? stepForTimestamp(steps, event.ts_monotonic_ms)) : undefined;
        if (isHttpRequestEvent(event)) {
            const attribution = attributionForHttp(options.feature, event, baseline, timingMaterialEvents.has(event), eventStepId);
            if (attribution === "unknown") unknownEvents += 1;
            if (attribution === "background") backgroundEvents += 1;
            const key = httpSummaryKey(eventStepId, event);
            const item = items.get(key) ?? {
                type: "http",
                step_id: eventStepId,
                method: event.method,
                route: `${event.method} ${event.normalized_route}`,
                attribution,
            };
            item.method = event.method;
            item.route = `${event.method} ${event.normalized_route}`;
            item.request_shape = event.request_body_shape_hash ?? item.request_shape;
            item.request_sample_redacted = event.request_body_redacted ?? item.request_sample_redacted;
            item.initiator_stack_hash = requestInitiatorStackHash(event) ?? item.initiator_stack_hash;
            item.initiator_frames = requestInitiatorFrames(event) ?? item.initiator_frames;
            item.attribution = mergeAttribution(item.attribution, attribution);
            items.set(key, item);
            continue;
        }

        if (isHttpResponseEvent(event)) {
            const attribution = attributionForHttp(options.feature, event, baseline, timingMaterialEvents.has(event), eventStepId);
            if (attribution === "unknown") unknownEvents += 1;
            if (attribution === "background") backgroundEvents += 1;
            const key = httpSummaryKey(eventStepId, event);
            const item = items.get(key) ?? {
                type: "http",
                step_id: eventStepId,
                method: event.method,
                route: `${event.method ?? "HTTP"} ${event.normalized_route}`,
                attribution,
            };
            item.method = event.method ?? item.method;
            item.route = `${event.method ?? item.method ?? "HTTP"} ${event.normalized_route}`;
            item.response_shape = responseBodyShapeHash(event) ?? item.response_shape;
            item.response_sample_redacted = responseBodyRedacted(event) ?? item.response_sample_redacted;
            item.status_codes = Array.from(new Set([...(item.status_codes ?? []), event.status])).sort((a, b) => a - b);
            item.attribution = mergeAttribution(item.attribution, attribution);
            items.set(key, item);
            continue;
        }

        if (isGatewayFrameEvent(event)) {
            const attribution = attributionForGateway(options.feature, event, baseline, timingMaterialEvents.has(event), eventStepId);
            if (attribution === "unknown") unknownEvents += 1;
            if (attribution === "background") backgroundEvents += 1;
            const key = `gateway:${eventStepId ?? ""}:${event.direction}:${event.gateway_event ?? event.opcode ?? ""}`;
            const item = items.get(key) ?? {
                type: "gateway",
                step_id: eventStepId,
                direction: event.direction,
                event: event.gateway_event,
                opcode: event.opcode,
                payload_shape: event.payload_shape_hash,
                attribution,
            };
            item.payload_shape = event.payload_shape_hash ?? item.payload_shape;
            item.payload_sample_redacted = event.payload_redacted ?? item.payload_sample_redacted;
            item.attribution = mergeAttribution(item.attribution, attribution);
            items.set(key, item);
        }
    }

    return {
        run_id: options.events[0]?.run_id ?? "",
        feature_id: options.feature.id,
        title: options.feature.title,
        expected: options.feature.expected,
        steps,
        traffic: Array.from(items.values()).sort(compareTrafficItems),
        unknown_events: unknownEvents,
        background_events: backgroundEvents,
        generated_at: new Date().toISOString(),
    };
}

function attributionForHttp(feature: FeatureDefinition, event: HttpSummaryEvent, baseline: CaptureEvent[], timingMaterial: boolean, stepId?: string): Attribution {
    const expected = feature.expected?.http?.some((item) => item.method === event.method && item.route === event.normalized_route && (!item.step_id || item.step_id === stepId));
    if (expected) {
        return "direct";
    }

    if (!timingMaterial && baseline.some((baselineEvent) => matchingHttpBaseline(event, baselineEvent))) {
        return "background";
    }

    return stepId ? "probable" : "unknown";
}

function attributionForGateway(feature: FeatureDefinition, event: GatewaySummaryEvent, baseline: CaptureEvent[], timingMaterial: boolean, stepId?: string): Attribution {
    const expected = feature.expected?.gateway?.some(
        (item) =>
            (!item.direction || item.direction === event.direction) &&
            (!item.event || item.event === event.gateway_event) &&
            (typeof item.opcode === "undefined" || item.opcode === event.opcode) &&
            (!item.step_id || item.step_id === stepId),
    );
    if (expected) {
        return "direct";
    }

    if (event.gateway_event === undefined && event.opcode === 1) {
        return "background";
    }

    if (!timingMaterial && baseline.some((baselineEvent) => matchingGatewayBaseline(event, baselineEvent))) {
        return "background";
    }

    return stepId ? "probable" : "unknown";
}

function matchingHttpBaseline(event: HttpSummaryEvent, baselineEvent: CaptureEvent): boolean {
    if (isHttpRequestEvent(event)) {
        return (
            isHttpRequestEvent(baselineEvent) &&
            baselineEvent.method === event.method &&
            baselineEvent.normalized_route === event.normalized_route &&
            materiallySame(event.request_body_shape_hash, baselineEvent.request_body_shape_hash)
        );
    }

    return (
        isHttpResponseEvent(baselineEvent) &&
        (baselineEvent.method ?? "") === (event.method ?? "") &&
        baselineEvent.normalized_route === event.normalized_route &&
        materiallySame(String(event.status), String(baselineEvent.status)) &&
        materiallySame(responseBodyShapeHash(event), responseBodyShapeHash(baselineEvent))
    );
}

function matchingGatewayBaseline(event: GatewaySummaryEvent, baselineEvent: CaptureEvent): boolean {
    return (
        isGatewayFrameEvent(baselineEvent) &&
        baselineEvent.direction === event.direction &&
        baselineEvent.opcode === event.opcode &&
        baselineEvent.gateway_event === event.gateway_event &&
        materiallySame(event.payload_shape_hash, baselineEvent.payload_shape_hash)
    );
}

function materiallySame(current: string | undefined, baseline: string | undefined): boolean {
    return !current || !baseline || current === baseline;
}

function isHttpRequestEvent(event: CaptureEvent): event is HttpRequestSummaryEvent {
    return event.kind === "http.request" || event.kind === "playwright.http.request";
}

function isHttpResponseEvent(event: CaptureEvent): event is HttpResponseSummaryEvent {
    return event.kind === "http.response" || event.kind === "playwright.http.response";
}

function isGatewayFrameEvent(event: CaptureEvent): event is GatewaySummaryEvent {
    return event.kind === "ws.frame.sent" || event.kind === "ws.frame.received" || event.kind === "playwright.ws.frame.sent" || event.kind === "playwright.ws.frame.received";
}

function httpSummaryKey(stepId: string | undefined, event: HttpSummaryEvent): string {
    const requestId = httpCorrelationId(event);
    if (requestId) {
        return `http:${httpCorrelationSource(event)}:${requestId}`;
    }
    return `http:${stepId ?? ""}:${event.method ?? ""}:${event.normalized_route}`;
}

function httpCorrelationId(event: HttpSummaryEvent): string | undefined {
    if ("cdp_request_id" in event) {
        return event.cdp_request_id;
    }
    if ("playwright_request_id" in event) {
        return event.playwright_request_id;
    }
    return undefined;
}

function httpCorrelationSource(event: HttpSummaryEvent): "cdp" | "playwright" {
    return "playwright_request_id" in event ? "playwright" : "cdp";
}

function requestInitiatorStackHash(event: HttpRequestSummaryEvent): string | undefined {
    return "initiator" in event ? event.initiator?.stack_hash : undefined;
}

function requestInitiatorFrames(event: HttpRequestSummaryEvent): NonNullable<HttpRequestEvent["initiator"]>["frames"] | undefined {
    return "initiator" in event ? event.initiator?.frames : undefined;
}

function responseBodyShapeHash(event: HttpResponseSummaryEvent): string | undefined {
    return "response_body_shape_hash" in event ? event.response_body_shape_hash : undefined;
}

function responseBodyRedacted(event: HttpResponseSummaryEvent): unknown {
    return "response_body_redacted" in event ? event.response_body_redacted : undefined;
}

const causativeActions = new Set(["click", "fill", "goto-channel", "press", "set-input-files", "type"]);
const actionProximityWindowMs = 2000;
const actionProximityEventWindow = 8;

function actionTimingMaterialEvents(events: CaptureEvent[]): Set<CaptureEvent> {
    const materialEvents = new Set<CaptureEvent>();
    const activeSteps: string[] = [];
    const lastActionByStep = new Map<string, { index: number; timestamp: number }>();

    events.forEach((event, index) => {
        if (event.kind === "step.start") {
            activeSteps.push(event.step_id);
            return;
        }
        if (event.kind === "step.end") {
            const stackIndex = activeSteps.lastIndexOf(event.step_id);
            if (stackIndex >= 0) {
                activeSteps.splice(stackIndex, 1);
            }
            return;
        }

        const stepId = "step_id" in event ? (event.step_id ?? activeSteps.at(-1)) : activeSteps.at(-1);
        if (!stepId) {
            return;
        }

        if (event.kind === "ui.action") {
            if (causativeActions.has(event.action)) {
                lastActionByStep.set(stepId, {
                    index,
                    timestamp: event.ts_monotonic_ms,
                });
            }
            return;
        }

        if (!isHttpRequestEvent(event) && !isHttpResponseEvent(event) && !isGatewayFrameEvent(event)) {
            return;
        }

        const lastAction = lastActionByStep.get(stepId);
        if (!lastAction) {
            return;
        }

        const elapsedMs = event.ts_monotonic_ms - lastAction.timestamp;
        if ((elapsedMs >= 0 && elapsedMs <= actionProximityWindowMs) || index - lastAction.index <= actionProximityEventWindow) {
            materialEvents.add(event);
        }
    });

    return materialEvents;
}

function stepWindows(events: CaptureEvent[]): FeatureStepSummary[] {
    const windows: FeatureStepSummary[] = [];
    for (const event of events) {
        if (event.kind === "step.start") {
            windows.push({
                step_id: event.step_id,
                title: event.title,
                started_at_ms: event.ts_monotonic_ms,
            });
        } else if (event.kind === "step.end") {
            const window = [...windows].reverse().find((item) => item.step_id === event.step_id && typeof item.ended_at_ms === "undefined");
            if (window) {
                window.ended_at_ms = event.ts_monotonic_ms;
                window.title ??= event.title;
            }
        } else if (event.kind === "ui.action") {
            const window = stepForAction(windows, event.step_id, event.ts_monotonic_ms);
            if (window) {
                window.actions = [...(window.actions ?? []), actionSummary(event)];
            }
        }
    }

    return windows;
}

function actionSummary(event: Extract<CaptureEvent, { kind: "ui.action" }>): FeatureActionSummary {
    return {
        action: event.action,
        ...(event.target ? { target: event.target } : {}),
        ...(event.detail ? { detail: event.detail } : {}),
        ...(event.value_redacted ? { value_redacted: event.value_redacted } : {}),
        occurred_at_ms: event.ts_monotonic_ms,
    };
}

function stepForAction(windows: FeatureStepSummary[], stepId: string | undefined, timestamp: number): FeatureStepSummary | undefined {
    return [...windows]
        .reverse()
        .find((window) => (!stepId || window.step_id === stepId) && timestamp >= window.started_at_ms && timestamp <= (window.ended_at_ms ?? Number.MAX_SAFE_INTEGER));
}

function stepForTimestamp(windows: FeatureStepSummary[], timestamp: number): string | undefined {
    return windows.find((window) => timestamp >= window.started_at_ms && timestamp <= (window.ended_at_ms ?? Number.MAX_SAFE_INTEGER))?.step_id;
}

function mergeAttribution(current: Attribution, next: Attribution): Attribution {
    const order: Attribution[] = ["direct", "probable", "unknown", "background"];
    return order[Math.min(order.indexOf(current), order.indexOf(next))];
}

function compareTrafficItems(a: TrafficSummaryItem, b: TrafficSummaryItem): number {
    return [a.step_id ?? "", a.type, a.route ?? a.event ?? String(a.opcode ?? "")]
        .join(":")
        .localeCompare([b.step_id ?? "", b.type, b.route ?? b.event ?? String(b.opcode ?? "")].join(":"));
}
