import { BuildSnapshot, FeatureSummary, GatewayCatalog, GatewayEventCatalogEntry, GatewayOpcodeCatalogEntry, RouteCatalogEntry } from "../types.js";

export interface RouteCoverageEntry {
    route: string;
    methods_observed: string[];
    feature_ids: string[];
    observed_run_ids: string[];
    build_ids: string[];
    first_observed_run_id?: string;
    last_observed_run_id?: string;
    first_observed_build?: string;
    last_observed_build?: string;
    payload_shape_hashes: string[];
    response_shape_hashes: string[];
    request_shape_history: CoverageShapeHistoryEntry[];
    response_shape_history: CoverageShapeHistoryEntry[];
    catalog?: RouteCoverageCatalogAnnotation;
}

export interface GatewayCoverageEntry {
    event?: string;
    opcode?: number;
    directions: string[];
    feature_ids: string[];
    observed_run_ids: string[];
    build_ids: string[];
    first_observed_run_id?: string;
    last_observed_run_id?: string;
    first_observed_build?: string;
    last_observed_build?: string;
    payload_shape_hashes: string[];
    payload_shape_history: CoverageShapeHistoryEntry[];
    catalog?: GatewayCoverageCatalogAnnotation;
}

export interface CoverageShapeHistoryEntry {
    shape_hash: string;
    run_ids: string[];
    feature_ids: string[];
}

export interface RouteCoverageCatalogAnnotation {
    route_name: string;
    source: string;
    summary?: string;
    description?: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
}

export interface GatewayCoverageCatalogAnnotation {
    name?: string;
    source: string;
    direction: "sent" | "received" | "both" | "unknown";
    payload_schema_ref?: string;
}

export interface CoverageOptions {
    builds?: Pick<BuildSnapshot, "run_id" | "x_build_id" | "build_number" | "version_hash" | "collected_at">[];
    routeCatalog?: RouteCatalogEntry[];
    gatewayCatalog?: GatewayCatalog;
    includeBackground?: boolean;
}

interface ObservationTarget {
    observed_run_ids: string[];
    build_ids: string[];
    first_observed_run_id?: string;
    last_observed_run_id?: string;
    first_observed_build?: string;
    last_observed_build?: string;
    _first_observed_sort_key?: string;
    _last_observed_sort_key?: string;
}

export function buildRouteCoverage(summaries: FeatureSummary[], options: CoverageOptions = {}): RouteCoverageEntry[] {
    const entries = new Map<string, RouteCoverageEntry>();
    const builds = buildContextByRunId(options.builds);
    const routeCatalog = routeCatalogByKey(options.routeCatalog);
    for (const summary of summaries) {
        for (const item of summary.traffic) {
            if (!options.includeBackground && item.attribution === "background") {
                continue;
            }
            if (item.type !== "http" || !item.route) {
                continue;
            }

            const key = item.route;
            const entry = entries.get(key) ?? {
                route: item.route,
                methods_observed: [],
                feature_ids: [],
                observed_run_ids: [],
                build_ids: [],
                payload_shape_hashes: [],
                response_shape_hashes: [],
                request_shape_history: [],
                response_shape_history: [],
                catalog: routeCatalog.get(item.route),
            };
            addUnique(entry.methods_observed, item.method);
            addUnique(entry.feature_ids, summary.feature_id);
            addObservation(entry, summary, builds.get(summary.run_id));
            addUnique(entry.payload_shape_hashes, item.request_shape);
            addUnique(entry.response_shape_hashes, item.response_shape);
            addShapeHistory(entry.request_shape_history, item.request_shape, summary);
            addShapeHistory(entry.response_shape_history, item.response_shape, summary);
            entries.set(key, entry);
        }
    }

    return Array.from(entries.values())
        .map(sortCoverageEntry)
        .sort((a, b) => a.route.localeCompare(b.route));
}

export function buildGatewayCoverage(summaries: FeatureSummary[], options: CoverageOptions = {}): GatewayCoverageEntry[] {
    const entries = new Map<string, GatewayCoverageEntry>();
    const builds = buildContextByRunId(options.builds);
    const gatewayCatalog = gatewayCatalogByKey(options.gatewayCatalog);
    for (const summary of summaries) {
        for (const item of summary.traffic) {
            if (!options.includeBackground && item.attribution === "background") {
                continue;
            }
            if (item.type !== "gateway") {
                continue;
            }

            const key = `${item.direction ?? ""}:${item.event ?? item.opcode ?? ""}`;
            const entry = entries.get(key) ?? {
                event: item.event,
                opcode: item.opcode,
                directions: [],
                feature_ids: [],
                observed_run_ids: [],
                build_ids: [],
                payload_shape_hashes: [],
                payload_shape_history: [],
                catalog: gatewayCatalog.get(key),
            };
            addUnique(entry.directions, item.direction);
            addUnique(entry.feature_ids, summary.feature_id);
            addObservation(entry, summary, builds.get(summary.run_id));
            addUnique(entry.payload_shape_hashes, item.payload_shape);
            addShapeHistory(entry.payload_shape_history, item.payload_shape, summary);
            entries.set(key, entry);
        }
    }

    return Array.from(entries.values())
        .map(sortGatewayCoverageEntry)
        .sort((a, b) => `${a.event ?? a.opcode ?? ""}`.localeCompare(`${b.event ?? b.opcode ?? ""}`));
}

function sortCoverageEntry(entry: RouteCoverageEntry): RouteCoverageEntry {
    const { _first_observed_sort_key, _last_observed_sort_key, ...publicEntry } = entry as RouteCoverageEntry & ObservationTarget;
    return {
        ...publicEntry,
        methods_observed: entry.methods_observed.sort(),
        feature_ids: entry.feature_ids.sort(),
        observed_run_ids: entry.observed_run_ids.sort(),
        build_ids: entry.build_ids.sort(),
        payload_shape_hashes: entry.payload_shape_hashes.sort(),
        response_shape_hashes: entry.response_shape_hashes.sort(),
        request_shape_history: sortShapeHistory(entry.request_shape_history),
        response_shape_history: sortShapeHistory(entry.response_shape_history),
    };
}

function sortGatewayCoverageEntry(entry: GatewayCoverageEntry): GatewayCoverageEntry {
    const { _first_observed_sort_key, _last_observed_sort_key, ...publicEntry } = entry as GatewayCoverageEntry & ObservationTarget;
    return {
        ...publicEntry,
        directions: entry.directions.sort(),
        feature_ids: entry.feature_ids.sort(),
        observed_run_ids: entry.observed_run_ids.sort(),
        build_ids: entry.build_ids.sort(),
        payload_shape_hashes: entry.payload_shape_hashes.sort(),
        payload_shape_history: sortShapeHistory(entry.payload_shape_history),
    };
}

function addUnique(values: string[], value: string | undefined): void {
    if (value && !values.includes(value)) {
        values.push(value);
    }
}

function addObservation(
    entry: ObservationTarget,
    summary: FeatureSummary,
    build: Pick<BuildSnapshot, "x_build_id" | "build_number" | "version_hash" | "collected_at"> | undefined,
): void {
    addUnique(entry.observed_run_ids, summary.run_id);
    const buildId = buildIdentity(build);
    addUnique(entry.build_ids, buildId);
    const sortKey = `${build?.collected_at ?? summary.generated_at}:${summary.run_id}`;
    if (!entry._first_observed_sort_key || sortKey < entry._first_observed_sort_key) {
        entry._first_observed_sort_key = sortKey;
        entry.first_observed_run_id = summary.run_id;
        entry.first_observed_build = buildId;
    }
    if (!entry._last_observed_sort_key || sortKey > entry._last_observed_sort_key) {
        entry._last_observed_sort_key = sortKey;
        entry.last_observed_run_id = summary.run_id;
        entry.last_observed_build = buildId;
    }
}

function addShapeHistory(history: CoverageShapeHistoryEntry[], shapeHash: string | undefined, summary: FeatureSummary): void {
    if (!shapeHash) {
        return;
    }
    const entry = history.find((item) => item.shape_hash === shapeHash) ?? {
        shape_hash: shapeHash,
        run_ids: [],
        feature_ids: [],
    };
    addUnique(entry.run_ids, summary.run_id);
    addUnique(entry.feature_ids, summary.feature_id);
    if (!history.includes(entry)) {
        history.push(entry);
    }
}

function sortShapeHistory(history: CoverageShapeHistoryEntry[]): CoverageShapeHistoryEntry[] {
    return history
        .map((entry) => ({
            shape_hash: entry.shape_hash,
            run_ids: entry.run_ids.sort(),
            feature_ids: entry.feature_ids.sort(),
        }))
        .sort((a, b) => a.shape_hash.localeCompare(b.shape_hash));
}

function buildContextByRunId(builds: CoverageOptions["builds"] | undefined): Map<string, Pick<BuildSnapshot, "x_build_id" | "build_number" | "version_hash" | "collected_at">> {
    return new Map((builds ?? []).map((build) => [build.run_id, build]));
}

function routeCatalogByKey(catalog: RouteCatalogEntry[] | undefined): Map<string, RouteCoverageCatalogAnnotation> {
    return new Map(
        (catalog ?? []).map((entry) => [
            `${entry.method} ${entry.route}`,
            {
                route_name: entry.route_name,
                source: entry.source,
                summary: entry.summary,
                description: entry.description,
                request_schema_ref: entry.request_schema_ref,
                response_schema_refs: entry.response_schema_refs,
            },
        ]),
    );
}

function gatewayCatalogByKey(catalog: GatewayCatalog | undefined): Map<string, GatewayCoverageCatalogAnnotation> {
    const output = new Map<string, GatewayCoverageCatalogAnnotation>();
    for (const event of catalog?.events ?? []) {
        output.set(`received:${event.event}`, gatewayEventAnnotation(event));
        output.set(`sent:${event.event}`, gatewayEventAnnotation(event));
        output.set(`:${event.event}`, gatewayEventAnnotation(event));
    }
    for (const opcode of catalog?.opcodes ?? []) {
        output.set(`received:${opcode.opcode}`, gatewayOpcodeAnnotation(opcode));
        output.set(`sent:${opcode.opcode}`, gatewayOpcodeAnnotation(opcode));
        output.set(`:${opcode.opcode}`, gatewayOpcodeAnnotation(opcode));
    }
    return output;
}

function gatewayEventAnnotation(entry: GatewayEventCatalogEntry): GatewayCoverageCatalogAnnotation {
    return {
        name: entry.name,
        source: entry.source,
        direction: entry.direction,
        payload_schema_ref: entry.payload_schema_ref,
    };
}

function gatewayOpcodeAnnotation(entry: GatewayOpcodeCatalogEntry): GatewayCoverageCatalogAnnotation {
    return {
        name: entry.name,
        source: entry.source,
        direction: entry.direction,
    };
}

function buildIdentity(build: Pick<BuildSnapshot, "x_build_id" | "build_number" | "version_hash"> | undefined): string | undefined {
    return build?.x_build_id ?? build?.build_number ?? build?.version_hash;
}
