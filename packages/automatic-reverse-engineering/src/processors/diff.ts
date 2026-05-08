import { BuildSnapshot, FeatureSummary, TrafficSummaryItem } from "../types.js";
import type { ReviewQueueItem } from "./reviewQueue.js";

export interface FeatureTrafficDiff {
    feature_id: string;
    added: TrafficSummaryItem[];
    removed: TrafficSummaryItem[];
    changed: Array<{
        key: string;
        base: TrafficSummaryItem;
        head: TrafficSummaryItem;
        changes: string[];
    }>;
}

export interface FeatureTrafficDiffOptions {
    includeBackground?: boolean;
}

export interface BuildDiffSummary {
    features_changed: number;
    http_added: number;
    http_removed: number;
    http_changed: number;
    gateway_added: number;
    gateway_removed: number;
    gateway_changed: number;
    changed_shape_hashes: string[];
}

export interface SourceRefChange {
    key: string;
    base?: string;
    head?: string;
}

export interface BuildDiffReport {
    base_run_id: string;
    head_run_id: string;
    base_build_id?: string;
    head_build_id?: string;
    static_build_changed: boolean;
    static_changes: string[];
    added_asset_hashes: string[];
    removed_asset_hashes: string[];
    source_ref_changes: SourceRefChange[];
    runtime_feature_signature_changed: boolean;
    summary: BuildDiffSummary;
    feature_diffs: FeatureTrafficDiff[];
    confidence: "low" | "medium" | "high";
    review_queue?: ReviewQueueItem[];
    generated_at: string;
}

export interface BuildDiffOptions {
    featureDiffs?: FeatureTrafficDiff[];
    reviewQueue?: ReviewQueueItem[];
}

export function diffFeatureSummary(base: FeatureSummary, head: FeatureSummary, options: FeatureTrafficDiffOptions = {}): FeatureTrafficDiff {
    if (base.feature_id !== head.feature_id) {
        throw new Error(`Cannot diff different features: ${base.feature_id} vs ${head.feature_id}`);
    }

    const baseItems = keyedItems(filterTraffic(base.traffic, options));
    const headItems = keyedItems(filterTraffic(head.traffic, options));
    const added: TrafficSummaryItem[] = [];
    const removed: TrafficSummaryItem[] = [];
    const changed: FeatureTrafficDiff["changed"] = [];

    for (const [key, headItem] of headItems) {
        const baseItem = baseItems.get(key);
        if (!baseItem) {
            added.push(headItem);
            continue;
        }

        const changes = changedFields(baseItem, headItem);
        if (changes.length > 0) {
            changed.push({ key, base: baseItem, head: headItem, changes });
        }
    }

    for (const [key, baseItem] of baseItems) {
        if (!headItems.has(key)) {
            removed.push(baseItem);
        }
    }

    return {
        feature_id: base.feature_id,
        added: added.sort(compareTraffic),
        removed: removed.sort(compareTraffic),
        changed: changed.sort((a, b) => a.key.localeCompare(b.key)),
    };
}

export function diffFeatureSummarySets(baseSummaries: FeatureSummary[], headSummaries: FeatureSummary[], options: FeatureTrafficDiffOptions = {}): FeatureTrafficDiff[] {
    const baseByFeature = summaryByFeatureId(baseSummaries);
    const headByFeature = summaryByFeatureId(headSummaries);
    const featureIds = Array.from(new Set([...baseByFeature.keys(), ...headByFeature.keys()])).sort();
    const diffs: FeatureTrafficDiff[] = [];
    for (const featureId of featureIds) {
        const base = baseByFeature.get(featureId) ?? emptySummary(featureId, headByFeature.get(featureId)?.run_id ?? "");
        const head = headByFeature.get(featureId) ?? emptySummary(featureId, baseByFeature.get(featureId)?.run_id ?? "");
        const diff = diffFeatureSummary(base, head, options);
        if (diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0) {
            diffs.push(diff);
        }
    }

    return diffs;
}

export function diffBuildSnapshots(base: BuildSnapshot, head: BuildSnapshot, options: BuildDiffOptions = {}): BuildDiffReport {
    const featureDiffs = options.featureDiffs ?? [];
    const addedAssetHashes = head.asset_hashes.filter((hash) => !base.asset_hashes.includes(hash)).sort();
    const removedAssetHashes = base.asset_hashes.filter((hash) => !head.asset_hashes.includes(hash)).sort();
    const sourceRefChanges = diffSourceRefs(base.source_refs, head.source_refs);
    const staticChanges = staticChangedFields(base, head);
    const staticBuildChanged = staticChanges.length > 0 || addedAssetHashes.length > 0 || removedAssetHashes.length > 0 || sourceRefChanges.length > 0;
    const summary = summarizeFeatureDiffs(featureDiffs);

    return {
        base_run_id: base.run_id,
        head_run_id: head.run_id,
        base_build_id: buildIdentity(base),
        head_build_id: buildIdentity(head),
        static_build_changed: staticBuildChanged,
        static_changes: staticChanges,
        added_asset_hashes: addedAssetHashes,
        removed_asset_hashes: removedAssetHashes,
        source_ref_changes: sourceRefChanges,
        runtime_feature_signature_changed: summary.features_changed > 0,
        summary,
        feature_diffs: featureDiffs,
        confidence: confidenceFor(staticBuildChanged, featureDiffs, options.reviewQueue),
        review_queue: options.reviewQueue,
        generated_at: new Date().toISOString(),
    };
}

function filterTraffic(items: TrafficSummaryItem[], options: FeatureTrafficDiffOptions): TrafficSummaryItem[] {
    if (options.includeBackground) {
        return items;
    }
    return items.filter((item) => item.attribution !== "background");
}

function summaryByFeatureId(summaries: FeatureSummary[]): Map<string, FeatureSummary> {
    return new Map(summaries.map((summary) => [summary.feature_id, summary]));
}

function emptySummary(featureId: string, runId: string): FeatureSummary {
    return {
        run_id: runId,
        feature_id: featureId,
        traffic: [],
        unknown_events: 0,
        background_events: 0,
        generated_at: new Date(0).toISOString(),
    };
}

function keyedItems(items: TrafficSummaryItem[]): Map<string, TrafficSummaryItem> {
    const output = new Map<string, TrafficSummaryItem>();
    for (const item of items) {
        output.set(itemKey(item), item);
    }

    return output;
}

function itemKey(item: TrafficSummaryItem): string {
    if (item.type === "http") {
        return `http:${item.step_id ?? ""}:${item.route ?? ""}`;
    }

    return `gateway:${item.step_id ?? ""}:${item.direction ?? ""}:${item.event ?? item.opcode ?? ""}`;
}

function changedFields(base: TrafficSummaryItem, head: TrafficSummaryItem): string[] {
    const changes: string[] = [];
    if (base.request_shape !== head.request_shape) {
        changes.push("request_shape");
    }
    if (base.response_shape !== head.response_shape) {
        changes.push("response_shape");
    }
    if (base.payload_shape !== head.payload_shape) {
        changes.push("payload_shape");
    }
    if (base.attribution !== head.attribution) {
        changes.push("attribution");
    }

    return changes;
}

function compareTraffic(a: TrafficSummaryItem, b: TrafficSummaryItem): number {
    return itemKey(a).localeCompare(itemKey(b));
}

function staticChangedFields(base: BuildSnapshot, head: BuildSnapshot): string[] {
    const fields: Array<keyof Pick<BuildSnapshot, "channel" | "base_url" | "api_base_url" | "x_build_id" | "build_number" | "version_hash" | "built_at">> = [
        "channel",
        "base_url",
        "api_base_url",
        "x_build_id",
        "build_number",
        "version_hash",
        "built_at",
    ];
    return fields.filter((field) => base[field] !== head[field]);
}

function diffSourceRefs(base: BuildSnapshot["source_refs"], head: BuildSnapshot["source_refs"]): SourceRefChange[] {
    const keys = Array.from(new Set([...Object.keys(base), ...Object.keys(head)])).sort();
    return keys.filter((key) => base[key] !== head[key]).map((key) => ({ key, base: base[key], head: head[key] }));
}

function summarizeFeatureDiffs(featureDiffs: FeatureTrafficDiff[]): BuildDiffSummary {
    const changedShapeHashes = new Set<string>();
    let httpAdded = 0;
    let httpRemoved = 0;
    let httpChanged = 0;
    let gatewayAdded = 0;
    let gatewayRemoved = 0;
    let gatewayChanged = 0;

    for (const diff of featureDiffs) {
        httpAdded += diff.added.filter((item) => item.type === "http").length;
        httpRemoved += diff.removed.filter((item) => item.type === "http").length;
        gatewayAdded += diff.added.filter((item) => item.type === "gateway").length;
        gatewayRemoved += diff.removed.filter((item) => item.type === "gateway").length;
        for (const changed of diff.changed) {
            if (changed.head.type === "http") {
                httpChanged += 1;
            } else {
                gatewayChanged += 1;
            }
            for (const item of [changed.base, changed.head]) {
                addShapeHash(changedShapeHashes, item.request_shape);
                addShapeHash(changedShapeHashes, item.response_shape);
                addShapeHash(changedShapeHashes, item.payload_shape);
            }
        }
    }

    return {
        features_changed: featureDiffs.length,
        http_added: httpAdded,
        http_removed: httpRemoved,
        http_changed: httpChanged,
        gateway_added: gatewayAdded,
        gateway_removed: gatewayRemoved,
        gateway_changed: gatewayChanged,
        changed_shape_hashes: Array.from(changedShapeHashes).sort(),
    };
}

function addShapeHash(values: Set<string>, value: string | undefined): void {
    if (value) {
        values.add(value);
    }
}

function confidenceFor(staticBuildChanged: boolean, featureDiffs: FeatureTrafficDiff[], reviewQueue: ReviewQueueItem[] | undefined): BuildDiffReport["confidence"] {
    if (featureDiffs.length > 0 && typeof reviewQueue !== "undefined") {
        return "high";
    }
    if (featureDiffs.length > 0 || staticBuildChanged) {
        return "medium";
    }
    return "low";
}

function buildIdentity(build: BuildSnapshot): string | undefined {
    return build.x_build_id ?? build.build_number ?? build.version_hash;
}
