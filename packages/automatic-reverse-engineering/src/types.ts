export type DiscordClientChannel = "stable" | "ptb" | "canary";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
export type Attribution = "direct" | "probable" | "background" | "unknown";
export type RedactedHeaders = Record<string, string | string[]>;
export type RuntimeAbortReason = "rate_limited" | "captcha" | "checkpoint";

export interface SourceRefs {
    xhyrom_routes_commit?: string;
    userdoccers_commit?: string;
    [key: string]: string | undefined;
}

export interface BuildSnapshot {
    run_id: string;
    channel: DiscordClientChannel;
    base_url: string;
    api_base_url: string;
    x_build_id?: string;
    build_number?: string;
    version_hash?: string;
    built_at?: string;
    asset_hashes: string[];
    source_refs: SourceRefs;
    collected_at: string;
}

export interface AssetSnapshot {
    url: string;
    kind: "script" | "stylesheet" | "other";
    file_name: string;
    hash?: string;
    bytes?: number;
    content_type?: string;
    local_path?: string;
    local_hash?: string;
    local_bytes?: number;
    local_redacted?: boolean;
    is_entrypoint?: boolean;
    discovered_from?: string;
}

export interface StaticSnapshot {
    build: BuildSnapshot;
    assets: AssetSnapshot[];
    login_html: string;
}

export interface RouteCatalogEntry {
    method: HttpMethod;
    route: string;
    route_name: string;
    source: string;
    summary?: string;
    description?: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
}

export interface GatewayOpcodeCatalogEntry {
    opcode: number;
    name: string;
    direction: "sent" | "received" | "both" | "unknown";
    handler?: string;
    source: string;
}

export interface GatewayEventCatalogEntry {
    event: string;
    name?: string;
    direction: "sent" | "received" | "both" | "unknown";
    source: string;
    payload_schema_ref?: string;
}

export interface GatewayCatalog {
    opcodes: GatewayOpcodeCatalogEntry[];
    events: GatewayEventCatalogEntry[];
}

export interface FeatureDefinition {
    id: string;
    title: string;
    channel?: DiscordClientChannel;
    requiredFixtures?: string[];
    safety?: {
        destructive?: boolean;
        requiredDisposableFixtures?: string[];
    };
    tags?: string[];
    expected?: {
        http?: Array<{
            method: HttpMethod;
            route: string;
            step_id?: string;
        }>;
        gateway?: Array<{
            direction?: "sent" | "received";
            event?: string;
            opcode?: number;
            step_id?: string;
        }>;
    };
}

export interface StepMarkerEvent {
    run_id: string;
    feature_id: string;
    step_id: string;
    ts_monotonic_ms: number;
    kind: "step.start" | "step.end";
    title?: string;
}

export type UiActionKind = "goto-channel" | "expect-ready" | "expect-network" | "expect-gateway" | "fill" | "click" | "context-click" | "press" | "type" | "set-input-files";

export interface UiActionDetails {
    action: UiActionKind;
    target?: string;
    detail?: string;
    value_redacted?: boolean;
}

export interface UiActionEvent extends UiActionDetails {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "ui.action";
}

export interface HttpRequestEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "http.request";
    cdp_request_id: string;
    method: HttpMethod | string;
    url: string;
    normalized_route: string;
    route_name?: string;
    headers_redacted: true;
    request_headers_redacted?: RedactedHeaders;
    request_body_shape_hash?: string;
    request_body_shape?: unknown;
    request_body_redacted?: unknown;
    initiator?: {
        type?: string;
        stack_hash?: string;
        frames?: InitiatorStackFrame[];
    };
}

export interface InitiatorStackFrame {
    url: string;
    file_name?: string;
    function_name?: string;
    line_number?: number;
    column_number?: number;
}

export interface HttpResponseEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "http.response";
    cdp_request_id: string;
    method?: HttpMethod | string;
    url: string;
    normalized_route: string;
    route_name?: string;
    status: number;
    headers_redacted: true;
    response_headers_redacted?: RedactedHeaders;
    response_body_shape_hash?: string;
    response_body_shape?: unknown;
    response_body_redacted?: unknown;
}

export interface HttpFailureEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "http.failure";
    cdp_request_id: string;
    url?: string;
    normalized_route?: string;
    error_text?: string;
}

export interface HttpExtraInfoEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "http.request.extra_info" | "http.response.extra_info";
    cdp_request_id: string;
    headers_redacted: true;
    request_headers_redacted?: RedactedHeaders;
    response_headers_redacted?: RedactedHeaders;
    status?: number;
}

export interface WebSocketLifecycleEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "ws.created" | "ws.closed" | "ws.error";
    websocket_id: string;
    url: string;
    error_text?: string;
}

export interface WebSocketHandshakeEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "ws.handshake.request" | "ws.handshake.response";
    websocket_id: string;
    url: string;
    headers_redacted: true;
    request_headers_redacted?: RedactedHeaders;
    response_headers_redacted?: RedactedHeaders;
    status?: number;
    status_text?: string;
}

export interface WebSocketFrameEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "ws.frame.sent" | "ws.frame.received";
    websocket_id: string;
    url: string;
    direction: "sent" | "received";
    opcode?: number;
    gateway_event?: string;
    sequence?: number;
    payload_shape_hash?: string;
    payload_shape?: unknown;
    payload_redacted?: unknown;
}

export interface RuntimeAbortEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "runtime.abort";
    reason: RuntimeAbortReason;
    message: string;
    quarantine: true;
    cdp_request_id?: string;
    url?: string;
    normalized_route?: string;
    status?: number;
    retry_after_ms?: number;
}

export interface PlaywrightHttpRequestEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "playwright.http.request";
    playwright_request_id: string;
    method: HttpMethod | string;
    url: string;
    normalized_route: string;
    headers_redacted: true;
    request_headers_redacted?: RedactedHeaders;
    request_body_shape_hash?: string;
    request_body_shape?: unknown;
    request_body_redacted?: unknown;
}

export interface PlaywrightHttpResponseEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "playwright.http.response";
    playwright_request_id: string;
    method?: HttpMethod | string;
    url: string;
    normalized_route: string;
    status: number;
    headers_redacted: true;
    response_headers_redacted?: RedactedHeaders;
}

export interface PlaywrightWebSocketLifecycleEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "playwright.ws.created" | "playwright.ws.closed" | "playwright.ws.error";
    websocket_id: string;
    url: string;
    error_text?: string;
}

export interface PlaywrightWebSocketFrameEvent {
    run_id: string;
    feature_id: string;
    step_id?: string;
    ts_monotonic_ms: number;
    kind: "playwright.ws.frame.sent" | "playwright.ws.frame.received";
    websocket_id: string;
    url: string;
    direction: "sent" | "received";
    opcode?: number;
    gateway_event?: string;
    sequence?: number;
    payload_shape_hash?: string;
    payload_shape?: unknown;
    payload_redacted?: unknown;
}

export type CaptureEvent =
    | StepMarkerEvent
    | UiActionEvent
    | HttpRequestEvent
    | HttpResponseEvent
    | HttpFailureEvent
    | HttpExtraInfoEvent
    | WebSocketLifecycleEvent
    | WebSocketHandshakeEvent
    | WebSocketFrameEvent
    | RuntimeAbortEvent
    | PlaywrightHttpRequestEvent
    | PlaywrightHttpResponseEvent
    | PlaywrightWebSocketLifecycleEvent
    | PlaywrightWebSocketFrameEvent;

export interface TrafficSummaryItem {
    type: "http" | "gateway";
    step_id?: string;
    route?: string;
    method?: string;
    status_codes?: number[];
    direction?: "sent" | "received";
    event?: string;
    opcode?: number;
    request_shape?: string;
    response_shape?: string;
    payload_shape?: string;
    request_sample_redacted?: unknown;
    response_sample_redacted?: unknown;
    payload_sample_redacted?: unknown;
    initiator_stack_hash?: string;
    initiator_frames?: InitiatorStackFrame[];
    attribution: Attribution;
    static_candidates?: StaticCandidate[];
    experiment_candidates?: ExperimentCandidate[];
}

export interface StaticCandidate {
    chunk?: string;
    module_id?: string;
    stack_hash?: string;
    generated_offset?: number;
    line_number?: number;
    column_number?: number;
    source_file?: string;
    source_name?: string;
    source_line_number?: number;
    source_column_number?: number;
    source_context?: string;
    source_context_hash?: string;
    source_context_truncated?: boolean;
    confidence: "low" | "medium" | "high";
}

export interface ExperimentCandidate {
    source: string;
    context_hash: string;
    confidence: "low" | "medium";
    module_id?: string;
    source_offset?: number;
    key?: string;
    value?: string;
    id?: string;
    label?: string;
    hash?: number;
    config_keys?: string[];
}

export interface FeatureStepSummary {
    step_id: string;
    title?: string;
    started_at_ms: number;
    ended_at_ms?: number;
    actions?: FeatureActionSummary[];
}

export interface FeatureActionSummary {
    action: UiActionKind;
    target?: string;
    detail?: string;
    value_redacted?: boolean;
    occurred_at_ms: number;
}

export interface FeatureSummary {
    run_id: string;
    feature_id: string;
    title?: string;
    expected?: FeatureDefinition["expected"];
    steps?: FeatureStepSummary[];
    traffic: TrafficSummaryItem[];
    unknown_events: number;
    background_events: number;
    generated_at: string;
}

export type RuntimeFailureStage = "preflight" | "runtime" | "artifact";

export interface RuntimeArtifactPaths {
    preflight_path?: string;
    events_path?: string;
    playwright_events_path?: string;
    summary_path?: string;
    markdown_path?: string;
    trace_path?: string;
    screenshots_dir?: string;
    video_path?: string;
    redacted_har_path?: string;
    failure_path?: string;
}

export interface RuntimeFailureArtifact {
    run_id: string;
    feature_id: string;
    title?: string;
    stage: RuntimeFailureStage;
    failed_at: string;
    quarantine: true;
    redacted: true;
    error: {
        name: string;
        message: string;
        abort_reason?: RuntimeAbortReason;
        message_redacted?: boolean;
    };
    artifacts: RuntimeArtifactPaths;
}

export interface RuntimeRunArtifactManifest extends RuntimeArtifactPaths {
    status: "passed" | "failed" | "quarantined";
}
