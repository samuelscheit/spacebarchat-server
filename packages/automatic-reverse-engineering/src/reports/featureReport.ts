import path from "node:path";

import type { DocsIndexEntry } from "../collectors/static/docsIndex.js";
import { FixtureManifest, redactFixtureManifest } from "../fixtures/manifest.js";
import { ExperimentCandidate, FeatureActionSummary, FeatureStepSummary, FeatureSummary, StaticCandidate, StaticSnapshot, TrafficSummaryItem } from "../types.js";
import { writeJsonFile } from "../util/fs.js";
import { sortForStableJson } from "../util/json.js";

export interface FeatureReportOptions {
    summary: FeatureSummary;
    staticSnapshot?: Pick<StaticSnapshot, "build">;
    fixtures?: FixtureManifest;
    docsIndex?: DocsIndexEntry[];
}

export function renderFeatureMarkdownReport(options: FeatureReportOptions): string {
    const lines: string[] = [];
    const summary = options.summary;
    lines.push(`# Feature: ${summary.title ?? summary.feature_id}`);
    lines.push("");

    lines.push(`Run: ${summary.run_id}`);
    lines.push(`Scenario: ${summary.feature_id}`);
    if (options.staticSnapshot) {
        const build = options.staticSnapshot.build;
        lines.push(`Build: ${build.channel} ${build.build_number ?? "unknown"} / ${build.version_hash ?? build.x_build_id ?? "unknown"}`);
        if (build.x_build_id) {
            lines.push(`Build ID: ${build.x_build_id}`);
        }
        if (Object.keys(build.source_refs).length > 0) {
            lines.push(
                `Source refs: ${Object.entries(build.source_refs)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(", ")}`,
            );
        }
    }
    if (options.fixtures) {
        lines.push("");
        lines.push("Fixtures:");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify(sortForStableJson(redactFixtureManifest(options.fixtures)), null, "\t"));
        lines.push("```");
    }
    if (options.staticSnapshot || options.fixtures) {
        lines.push("");
    }

    const grouped = new Map<string, TrafficSummaryItem[]>();
    for (const item of summary.traffic) {
        const step = item.step_id ?? "unattributed";
        grouped.set(step, [...(grouped.get(step) ?? []), item]);
    }

    const stepMetadata = new Map((summary.steps ?? []).map((step) => [step.step_id, step]));
    const orderedSteps = orderedStepIds(summary, grouped);
    for (const step of orderedSteps) {
        const items = grouped.get(step) ?? [];
        lines.push(stepHeading(step, stepMetadata.get(step)));
        lines.push("");
        appendStepActions(lines, stepMetadata.get(step)?.actions);
        if (items.length === 0) {
            lines.push("No captured traffic.");
            lines.push("");
            continue;
        }

        const http = items.filter((item) => item.type === "http");
        if (http.length > 0) {
            lines.push("HTTP:");
            lines.push("");
            for (const item of http) {
                lines.push(`- ${item.attribution}: ${item.route ?? item.method ?? "HTTP"}`);
                if (item.status_codes?.length) {
                    lines.push(`  - status codes: ${item.status_codes.join(", ")}`);
                }
                if (item.request_shape) {
                    lines.push(`  - request shape: ${item.request_shape}`);
                }
                appendRedactedSample(lines, "request sample redacted", item.request_sample_redacted);
                if (item.response_shape) {
                    lines.push(`  - response shape: ${item.response_shape}`);
                }
                appendRedactedSample(lines, "response sample redacted", item.response_sample_redacted);
                appendDocsLinks(lines, item, options.docsIndex);
                appendStaticCandidates(lines, item.static_candidates);
                appendExperimentCandidates(lines, item.experiment_candidates);
            }
            lines.push("");
        }

        const gateway = items.filter((item) => item.type === "gateway");
        if (gateway.length > 0) {
            lines.push("Gateway:");
            lines.push("");
            for (const item of gateway) {
                const label = item.event ?? `opcode ${item.opcode ?? "unknown"}`;
                lines.push(`- ${item.attribution} ${item.direction ?? "unknown"}: ${label}`);
                if (item.payload_shape) {
                    lines.push(`  - payload shape: ${item.payload_shape}`);
                }
                appendRedactedSample(lines, "payload sample redacted", item.payload_sample_redacted);
                appendDocsLinks(lines, item, options.docsIndex);
                appendStaticCandidates(lines, item.static_candidates);
                appendExperimentCandidates(lines, item.experiment_candidates);
            }
            lines.push("");
        }
    }

    if (summary.unknown_events > 0 || summary.background_events > 0) {
        lines.push("Review:");
        lines.push("");
        lines.push(`- unknown events: ${summary.unknown_events}`);
        lines.push(`- background events: ${summary.background_events}`);
        lines.push("");
    }

    return `${lines.join("\n").trimEnd()}\n`;
}

const maxSampleJsonLength = 800;

function appendRedactedSample(lines: string[], label: string, sample: unknown): void {
    if (typeof sample === "undefined") {
        return;
    }

    const json = compactStableJson(sample);
    if (!json) {
        return;
    }

    lines.push(`  - ${label}: ${truncate(json, maxSampleJsonLength)}`);
}

function compactStableJson(value: unknown): string | undefined {
    try {
        return JSON.stringify(sortForStableJson(value));
    } catch {
        return undefined;
    }
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function orderedStepIds(summary: FeatureSummary, grouped: Map<string, TrafficSummaryItem[]>): string[] {
    const seen = new Set<string>();
    const steps: string[] = [];
    for (const step of summary.steps ?? []) {
        if (!seen.has(step.step_id)) {
            steps.push(step.step_id);
            seen.add(step.step_id);
        }
    }
    for (const step of grouped.keys()) {
        if (!seen.has(step)) {
            steps.push(step);
            seen.add(step);
        }
    }
    return steps;
}

function stepHeading(stepId: string, step: FeatureStepSummary | undefined): string {
    if (step?.title) {
        return `## Step: ${step.title} (${stepId})`;
    }
    return `## Step: ${stepId}`;
}

function appendStepActions(lines: string[], actions: FeatureActionSummary[] | undefined): void {
    if (!actions?.length) {
        return;
    }

    lines.push("Actions:");
    lines.push("");
    for (const action of actions) {
        const parts = [action.action, action.target, action.detail, action.value_redacted ? "value redacted" : undefined].filter((part): part is string => Boolean(part));
        lines.push(`- ${parts.join(" / ")}`);
    }
    lines.push("");
}

function appendExperimentCandidates(lines: string[], candidates: ExperimentCandidate[] | undefined): void {
    if (!candidates?.length) {
        return;
    }

    lines.push("  - experiment candidates:");
    for (const candidate of candidates.slice(0, 5)) {
        const label = [
            candidate.confidence,
            candidate.source,
            candidate.module_id ? `module ${candidate.module_id}` : undefined,
            candidate.key && candidate.value ? `${candidate.key}=${candidate.value}` : undefined,
            candidate.id,
            candidate.label,
            candidate.config_keys?.length ? `config ${candidate.config_keys.join(",")}` : undefined,
        ].filter((part): part is string => Boolean(part));
        lines.push(`    - ${label.join(" / ")}`);
    }
}

function appendDocsLinks(lines: string[], item: TrafficSummaryItem, docsIndex: DocsIndexEntry[] | undefined): void {
    const entries = docsEntriesForTraffic(item, docsIndex);
    if (entries.length === 0) {
        return;
    }

    lines.push("  - docs:");
    for (const entry of entries) {
        for (const [name, url] of Object.entries(entry.refs)) {
            lines.push(`    - ${name}: ${url}`);
        }
    }
}

function docsEntriesForTraffic(item: TrafficSummaryItem, docsIndex: DocsIndexEntry[] | undefined): DocsIndexEntry[] {
    if (!docsIndex?.length) {
        return [];
    }

    if (item.type === "http" && item.route) {
        return docsIndex.filter((entry) => entry.kind === "route" && entry.key === item.route);
    }

    if (item.type === "gateway" && item.event) {
        return docsIndex.filter((entry) => entry.kind === "gateway_event" && entry.key === item.event);
    }

    if (item.type === "gateway" && typeof item.opcode === "number") {
        return docsIndex.filter((entry) => entry.kind === "gateway_opcode" && entry.key.startsWith(`${item.opcode} `));
    }

    return [];
}

function appendStaticCandidates(lines: string[], candidates: StaticCandidate[] | undefined): void {
    if (!candidates?.length) {
        return;
    }

    lines.push("  - static candidates:");
    for (const candidate of candidates.slice(0, 5)) {
        const parts = [
            candidate.confidence,
            candidate.chunk,
            candidate.module_id ? `module ${candidate.module_id}` : undefined,
            candidate.source_file,
            typeof candidate.source_line_number === "number" ? `line ${candidate.source_line_number + 1}` : undefined,
            candidate.source_name,
            candidate.source_context ? `context ${candidate.source_context}` : undefined,
            candidate.source_context_hash ? `context ${truncate(candidate.source_context_hash, 24)}` : undefined,
            candidate.source_context_truncated ? "context truncated" : undefined,
        ].filter((part): part is string => Boolean(part));
        lines.push(`    - ${parts.join(" / ")}`);
    }
}

export async function writeFeatureReport(outputDir: string, options: FeatureReportOptions): Promise<{ summaryPath: string; markdownPath: string }> {
    const summaryPath = path.join(outputDir, "summary.json");
    const markdownPath = path.join(outputDir, "report.md");
    await writeJsonFile(summaryPath, options.summary);
    await import("node:fs/promises").then(({ writeFile }) => writeFile(markdownPath, renderFeatureMarkdownReport(options), "utf8"));

    return { summaryPath, markdownPath };
}
