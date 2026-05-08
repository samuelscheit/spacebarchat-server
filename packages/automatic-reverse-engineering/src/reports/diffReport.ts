import { BuildDiffReport, FeatureTrafficDiff } from "../processors/diff.js";
import { TrafficSummaryItem } from "../types.js";

export function renderFeatureDiffMarkdown(diff: FeatureTrafficDiff): string {
    const lines: string[] = [
        `# Feature Diff: ${diff.feature_id}`,
        "",
        `- added: ${diff.added.length}`,
        `- removed: ${diff.removed.length}`,
        `- changed: ${diff.changed.length}`,
        "",
    ];

    appendTrafficSection(lines, "Added Traffic", diff.added);
    appendTrafficSection(lines, "Removed Traffic", diff.removed);
    appendChangedSection(lines, diff.changed);

    return `${lines.join("\n").trimEnd()}\n`;
}

export function renderBuildDiffMarkdown(diff: BuildDiffReport): string {
    const lines: string[] = [
        `# Build Diff: ${diff.base_run_id} -> ${diff.head_run_id}`,
        "",
        `- static build changed: ${diff.static_build_changed}`,
        `- runtime feature signature changed: ${diff.runtime_feature_signature_changed}`,
        `- base build: ${diff.base_build_id ?? "unknown"}`,
        `- head build: ${diff.head_build_id ?? "unknown"}`,
        `- confidence: ${diff.confidence}`,
        `- review queue items: ${diff.review_queue?.length ?? 0}`,
        "",
        "## Static Build",
        "",
        `- changed fields: ${diff.static_changes.join(", ") || "none"}`,
        `- added asset hashes: ${diff.added_asset_hashes.length}`,
        `- removed asset hashes: ${diff.removed_asset_hashes.length}`,
        `- source ref changes: ${diff.source_ref_changes.map((item) => item.key).join(", ") || "none"}`,
        "",
        "## Runtime Summary",
        "",
        `- changed features: ${diff.summary.features_changed}`,
        `- HTTP added/removed/changed: ${diff.summary.http_added}/${diff.summary.http_removed}/${diff.summary.http_changed}`,
        `- Gateway added/removed/changed: ${diff.summary.gateway_added}/${diff.summary.gateway_removed}/${diff.summary.gateway_changed}`,
        `- changed shape hashes: ${diff.summary.changed_shape_hashes.join(", ") || "none"}`,
        "",
    ];

    for (const feature of diff.feature_diffs) {
        lines.push(`## Feature: ${feature.feature_id}`);
        lines.push("");
        lines.push(`- added: ${feature.added.length}`);
        lines.push(`- removed: ${feature.removed.length}`);
        lines.push(`- changed: ${feature.changed.length}`);
        lines.push("");
    }

    return `${lines.join("\n").trimEnd()}\n`;
}

function appendTrafficSection(lines: string[], title: string, items: TrafficSummaryItem[]): void {
    lines.push(`## ${title}`);
    lines.push("");
    if (items.length === 0) {
        lines.push("- none");
        lines.push("");
        return;
    }

    for (const item of items) {
        lines.push(`- ${trafficLabel(item)}`);
        lines.push(`  - attribution: ${item.attribution}`);
        if (item.step_id) {
            lines.push(`  - step: ${item.step_id}`);
        }
        appendShapeLines(lines, item);
    }
    lines.push("");
}

function appendChangedSection(lines: string[], changed: FeatureTrafficDiff["changed"]): void {
    lines.push("## Changed Traffic");
    lines.push("");
    if (changed.length === 0) {
        lines.push("- none");
        lines.push("");
        return;
    }

    for (const item of changed) {
        lines.push(`- ${item.key}`);
        lines.push(`  - changed fields: ${item.changes.join(", ")}`);
        lines.push(`  - before: ${trafficShapeSummary(item.base)}`);
        lines.push(`  - after: ${trafficShapeSummary(item.head)}`);
    }
    lines.push("");
}

function appendShapeLines(lines: string[], item: TrafficSummaryItem): void {
    if (item.request_shape) {
        lines.push(`  - request shape: ${item.request_shape}`);
    }
    if (item.response_shape) {
        lines.push(`  - response shape: ${item.response_shape}`);
    }
    if (item.payload_shape) {
        lines.push(`  - payload shape: ${item.payload_shape}`);
    }
    if (item.status_codes?.length) {
        lines.push(`  - status codes: ${item.status_codes.join(", ")}`);
    }
}

function trafficLabel(item: TrafficSummaryItem): string {
    if (item.type === "http") {
        return item.route ?? `${item.method ?? "HTTP"} unknown`;
    }

    return `${item.direction ?? "unknown"} ${item.event ?? `opcode ${item.opcode ?? "unknown"}`}`;
}

function trafficShapeSummary(item: TrafficSummaryItem): string {
    return [
        `attribution=${item.attribution}`,
        item.request_shape ? `request=${item.request_shape}` : undefined,
        item.response_shape ? `response=${item.response_shape}` : undefined,
        item.payload_shape ? `payload=${item.payload_shape}` : undefined,
    ]
        .filter(Boolean)
        .join(", ");
}
