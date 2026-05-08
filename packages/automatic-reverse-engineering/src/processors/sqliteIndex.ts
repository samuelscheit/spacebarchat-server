import { BuildSnapshot, FeatureSummary, GatewayCatalog, RouteCatalogEntry, TrafficSummaryItem } from "../types.js";
import { sortForStableJson } from "../util/json.js";

export interface SqliteIndexOptions {
    builds?: BuildSnapshot[];
    summaries?: FeatureSummary[];
    routeCatalog?: RouteCatalogEntry[];
    gatewayCatalog?: GatewayCatalog;
    includeBackground?: boolean;
    includeSamples?: boolean;
}

export function buildSqliteIndexSql(options: SqliteIndexOptions): string {
    const lines = [
        "-- Discord datamining SQLite index export",
        "PRAGMA foreign_keys=OFF;",
        "BEGIN TRANSACTION;",
        ...schemaStatements(),
        ...metaRows(options),
        ...runRows(options),
        ...featureRows(options),
        ...stepRows(options),
        ...trafficRows(options),
        ...payloadShapeRows(options),
        ...staticCandidateRows(options),
        ...routeCatalogRows(options.routeCatalog ?? []),
        ...gatewayCatalogRows(options.gatewayCatalog),
        "COMMIT;",
    ];

    return `${lines.join("\n")}\n`;
}

function schemaStatements(): string[] {
    return [
        "CREATE TABLE IF NOT EXISTS runs (run_id TEXT PRIMARY KEY, channel TEXT, base_url TEXT, api_base_url TEXT, x_build_id TEXT, build_number TEXT, version_hash TEXT, built_at TEXT, collected_at TEXT, source_refs_json TEXT, asset_hashes_json TEXT);",
        "CREATE TABLE IF NOT EXISTS sql_index_meta (schema_version INTEGER NOT NULL, generated_at TEXT NOT NULL, include_background INTEGER NOT NULL, include_samples INTEGER NOT NULL);",
        "CREATE TABLE IF NOT EXISTS features (run_id TEXT NOT NULL, feature_id TEXT NOT NULL, title TEXT, generated_at TEXT, unknown_events INTEGER NOT NULL, background_events INTEGER NOT NULL, PRIMARY KEY (run_id, feature_id));",
        "CREATE TABLE IF NOT EXISTS steps (run_id TEXT NOT NULL, feature_id TEXT NOT NULL, step_id TEXT NOT NULL, title TEXT, started_at_ms REAL, ended_at_ms REAL, actions_json TEXT, PRIMARY KEY (run_id, feature_id, step_id));",
        "CREATE TABLE IF NOT EXISTS http_events (traffic_key TEXT NOT NULL, run_id TEXT NOT NULL, feature_id TEXT NOT NULL, step_id TEXT, method TEXT, route TEXT, status_codes_json TEXT, attribution TEXT NOT NULL, request_shape TEXT, response_shape TEXT, request_sample_redacted_json TEXT, response_sample_redacted_json TEXT, initiator_stack_hash TEXT, initiator_frames_json TEXT);",
        "CREATE TABLE IF NOT EXISTS ws_events (traffic_key TEXT NOT NULL, run_id TEXT NOT NULL, feature_id TEXT NOT NULL, step_id TEXT, direction TEXT, gateway_event TEXT, opcode INTEGER, attribution TEXT NOT NULL, payload_shape TEXT, payload_sample_redacted_json TEXT);",
        "CREATE TABLE IF NOT EXISTS payload_shapes (traffic_key TEXT NOT NULL, run_id TEXT NOT NULL, feature_id TEXT NOT NULL, step_id TEXT, traffic_type TEXT NOT NULL, shape_kind TEXT NOT NULL, shape_hash TEXT NOT NULL, sample_redacted_json TEXT);",
        "CREATE TABLE IF NOT EXISTS route_catalog (method TEXT NOT NULL, route TEXT NOT NULL, route_name TEXT, source TEXT, summary TEXT, description TEXT, request_schema_ref TEXT, response_schema_refs_json TEXT, PRIMARY KEY (method, route, source));",
        "CREATE TABLE IF NOT EXISTS gateway_catalog (kind TEXT NOT NULL, opcode INTEGER, gateway_event TEXT, name TEXT, direction TEXT, source TEXT, payload_schema_ref TEXT);",
        "CREATE TABLE IF NOT EXISTS static_candidates (traffic_key TEXT NOT NULL, run_id TEXT NOT NULL, feature_id TEXT NOT NULL, step_id TEXT, traffic_type TEXT NOT NULL, route TEXT, gateway_event TEXT, opcode INTEGER, candidate_index INTEGER NOT NULL, chunk TEXT, module_id TEXT, stack_hash TEXT, generated_offset INTEGER, line_number INTEGER, column_number INTEGER, source_file TEXT, source_name TEXT, source_line_number INTEGER, source_column_number INTEGER, source_context TEXT, source_context_hash TEXT, source_context_truncated INTEGER, confidence TEXT NOT NULL);",
        "CREATE INDEX IF NOT EXISTS http_events_route_idx ON http_events(route);",
        "CREATE INDEX IF NOT EXISTS ws_events_gateway_event_idx ON ws_events(gateway_event);",
        "CREATE INDEX IF NOT EXISTS payload_shapes_hash_idx ON payload_shapes(shape_hash);",
    ];
}

function metaRows(options: SqliteIndexOptions): string[] {
    return [insert("sql_index_meta", [2, new Date().toISOString(), options.includeBackground === true ? 1 : 0, options.includeSamples === true ? 1 : 0])];
}

function runRows(options: SqliteIndexOptions): string[] {
    const buildsByRunId = new Map((options.builds ?? []).map((build) => [build.run_id, build]));
    for (const summary of options.summaries ?? []) {
        if (!buildsByRunId.has(summary.run_id)) {
            buildsByRunId.set(summary.run_id, {
                run_id: summary.run_id,
                channel: "canary",
                base_url: "",
                api_base_url: "",
                asset_hashes: [],
                source_refs: {},
                collected_at: summary.generated_at,
            });
        }
    }

    return Array.from(buildsByRunId.values())
        .sort((a, b) => a.run_id.localeCompare(b.run_id))
        .map((build) =>
            insert("runs", [
                build.run_id,
                build.channel,
                build.base_url,
                build.api_base_url,
                build.x_build_id,
                build.build_number,
                build.version_hash,
                build.built_at,
                build.collected_at,
                jsonValue(build.source_refs),
                jsonValue(build.asset_hashes),
            ]),
        );
}

function featureRows(options: SqliteIndexOptions): string[] {
    return (options.summaries ?? [])
        .sort(compareSummary)
        .map((summary) => insert("features", [summary.run_id, summary.feature_id, summary.title, summary.generated_at, summary.unknown_events, summary.background_events]));
}

function stepRows(options: SqliteIndexOptions): string[] {
    return (options.summaries ?? [])
        .sort(compareSummary)
        .flatMap((summary) =>
            (summary.steps ?? []).map((step) =>
                insert("steps", [summary.run_id, summary.feature_id, step.step_id, step.title, step.started_at_ms, step.ended_at_ms, jsonValue(step.actions)]),
            ),
        );
}

function trafficRows(options: SqliteIndexOptions): string[] {
    return trafficItems(options).flatMap(({ summary, item }) => {
        const key = trafficKey(summary, item);
        if (item.type === "http") {
            return [
                insert("http_events", [
                    key,
                    summary.run_id,
                    summary.feature_id,
                    item.step_id,
                    item.method,
                    item.route,
                    jsonValue(item.status_codes),
                    item.attribution,
                    item.request_shape,
                    item.response_shape,
                    sampleJsonValue(options, item.request_sample_redacted),
                    sampleJsonValue(options, item.response_sample_redacted),
                    item.initiator_stack_hash,
                    jsonValue(item.initiator_frames),
                ]),
            ];
        }

        return [
            insert("ws_events", [
                key,
                summary.run_id,
                summary.feature_id,
                item.step_id,
                item.direction,
                item.event,
                item.opcode,
                item.attribution,
                item.payload_shape,
                sampleJsonValue(options, item.payload_sample_redacted),
            ]),
        ];
    });
}

function payloadShapeRows(options: SqliteIndexOptions): string[] {
    return trafficItems(options).flatMap(({ summary, item }) => {
        const rows: string[] = [];
        if (item.type === "http") {
            if (item.request_shape) {
                rows.push(payloadShapeRow(options, summary, item, "request_body", item.request_shape, item.request_sample_redacted));
            }
            if (item.response_shape) {
                rows.push(payloadShapeRow(options, summary, item, "response_body", item.response_shape, item.response_sample_redacted));
            }
        } else if (item.payload_shape) {
            rows.push(payloadShapeRow(options, summary, item, "gateway_payload", item.payload_shape, item.payload_sample_redacted));
        }
        return rows;
    });
}

function payloadShapeRow(options: SqliteIndexOptions, summary: FeatureSummary, item: TrafficSummaryItem, shapeKind: string, shapeHash: string, sample: unknown): string {
    return insert("payload_shapes", [
        trafficKey(summary, item),
        summary.run_id,
        summary.feature_id,
        item.step_id,
        item.type,
        shapeKind,
        shapeHash,
        sampleJsonValue(options, sample),
    ]);
}

function staticCandidateRows(options: SqliteIndexOptions): string[] {
    return trafficItems(options).flatMap(({ summary, item }) =>
        (item.static_candidates ?? []).map((candidate, index) =>
            insert("static_candidates", [
                trafficKey(summary, item),
                summary.run_id,
                summary.feature_id,
                item.step_id,
                item.type,
                item.route,
                item.event,
                item.opcode,
                index,
                candidate.chunk,
                candidate.module_id,
                candidate.stack_hash,
                candidate.generated_offset,
                candidate.line_number,
                candidate.column_number,
                candidate.source_file,
                candidate.source_name,
                candidate.source_line_number,
                candidate.source_column_number,
                candidate.source_context,
                candidate.source_context_hash,
                typeof candidate.source_context_truncated === "boolean" ? (candidate.source_context_truncated ? 1 : 0) : undefined,
                candidate.confidence,
            ]),
        ),
    );
}

function routeCatalogRows(catalog: RouteCatalogEntry[]): string[] {
    return [...catalog]
        .sort((a, b) => `${a.method} ${a.route} ${a.source}`.localeCompare(`${b.method} ${b.route} ${b.source}`))
        .map((entry) =>
            insert("route_catalog", [
                entry.method,
                entry.route,
                entry.route_name,
                entry.source,
                entry.summary,
                entry.description,
                entry.request_schema_ref,
                jsonValue(entry.response_schema_refs),
            ]),
        );
}

function gatewayCatalogRows(catalog: GatewayCatalog | undefined): string[] {
    return [
        ...(catalog?.opcodes ?? []).map((entry) => insert("gateway_catalog", ["opcode", entry.opcode, undefined, entry.name, entry.direction, entry.source, undefined])),
        ...(catalog?.events ?? []).map((entry) =>
            insert("gateway_catalog", ["event", undefined, entry.event, entry.name, entry.direction, entry.source, entry.payload_schema_ref]),
        ),
    ].sort();
}

function trafficItems(options: SqliteIndexOptions): Array<{ summary: FeatureSummary; item: TrafficSummaryItem }> {
    return (options.summaries ?? [])
        .sort(compareSummary)
        .flatMap((summary) => summary.traffic.filter((item) => options.includeBackground || item.attribution !== "background").map((item) => ({ summary, item })));
}

function compareSummary(a: FeatureSummary, b: FeatureSummary): number {
    return `${a.run_id}:${a.feature_id}`.localeCompare(`${b.run_id}:${b.feature_id}`);
}

function trafficKey(summary: FeatureSummary, item: TrafficSummaryItem): string {
    return [
        summary.run_id,
        summary.feature_id,
        item.step_id ?? "",
        item.type,
        item.route ?? "",
        item.direction ?? "",
        item.event ?? "",
        typeof item.opcode === "number" ? String(item.opcode) : "",
    ].join("|");
}

function insert(table: string, values: unknown[]): string {
    return `INSERT INTO ${table} VALUES (${values.map(sqlValue).join(", ")});`;
}

function sqlValue(value: unknown): string {
    if (typeof value === "undefined" || value === null) {
        return "NULL";
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonValue(value: unknown): string | undefined {
    if (typeof value === "undefined") {
        return undefined;
    }
    return JSON.stringify(sortForStableJson(value));
}

function sampleJsonValue(options: SqliteIndexOptions, value: unknown): string | undefined {
    if (options.includeSamples !== true) {
        return undefined;
    }
    return jsonValue(value);
}
