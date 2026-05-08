import { FeatureTrafficDiff } from "./diff.js";
import { getBuiltInScenario } from "../scenarios/registry.js";
import { FeatureSummary, GatewayCatalog, RouteCatalogEntry, RuntimeFailureArtifact, TrafficSummaryItem } from "../types.js";

export type ReviewQueueReason =
    | "unknown_attribution"
    | "new_route"
    | "new_gateway_event"
    | "changed_signature"
    | "sensitive_route"
    | "scenario_expectation_failed"
    | "runtime_failure"
    | "runtime_abort";

export interface ReviewQueueItem {
    feature_id: string;
    step_id?: string;
    reason: ReviewQueueReason;
    severity: "low" | "medium" | "high";
    subject: string;
    detail?: string;
}

export interface ReviewQueueOptions {
    summaries?: FeatureSummary[];
    routeCatalog?: RouteCatalogEntry[];
    gatewayCatalog?: GatewayCatalog;
    diffs?: FeatureTrafficDiff[];
    failures?: RuntimeFailureArtifact[];
    includeBackground?: boolean;
}

const sensitiveRoutePattern = /(auth|login|mfa|billing|payment|entitlement|oauth2|delete|disable|sessions|tokens?)/i;

export function buildReviewQueue(options: ReviewQueueOptions): ReviewQueueItem[] {
    const routeCatalogKeys = new Set((options.routeCatalog ?? []).map((entry) => `${entry.method} ${entry.route}`));
    const gatewayEvents = new Set((options.gatewayCatalog?.events ?? []).map((entry) => entry.event));
    const items: ReviewQueueItem[] = [];

    for (const summary of options.summaries ?? []) {
        for (const traffic of summary.traffic) {
            if (!options.includeBackground && traffic.attribution === "background") {
                continue;
            }
            items.push(...reviewTraffic(summary.feature_id, traffic, routeCatalogKeys, gatewayEvents));
        }
        if (summary.unknown_events > 0) {
            items.push({
                feature_id: summary.feature_id,
                reason: "unknown_attribution",
                severity: "medium",
                subject: `${summary.unknown_events} unknown event(s)`,
                detail: "Correlation could not classify one or more runtime events.",
            });
        }
        items.push(...reviewMissingExpectedTraffic(summary));
    }

    for (const diff of options.diffs ?? []) {
        for (const changed of diff.changed) {
            if (!options.includeBackground && changed.base.attribution === "background" && changed.head.attribution === "background") {
                continue;
            }
            items.push({
                feature_id: diff.feature_id,
                step_id: changed.head.step_id,
                reason: "changed_signature",
                severity: "high",
                subject: changed.key,
                detail: `Changed fields: ${changed.changes.join(", ")}`,
            });
        }
        for (const added of diff.added) {
            if (!options.includeBackground && added.attribution === "background") {
                continue;
            }
            items.push({
                feature_id: diff.feature_id,
                step_id: added.step_id,
                reason: "changed_signature",
                severity: "medium",
                subject: trafficSubject(added),
                detail: "Traffic item added in head run.",
            });
        }
        for (const removed of diff.removed) {
            if (!options.includeBackground && removed.attribution === "background") {
                continue;
            }
            items.push({
                feature_id: diff.feature_id,
                step_id: removed.step_id,
                reason: "changed_signature",
                severity: "medium",
                subject: trafficSubject(removed),
                detail: "Traffic item removed in head run.",
            });
        }
    }

    for (const failure of options.failures ?? []) {
        items.push(reviewFailure(failure));
    }

    return dedupe(items).sort(compareReviewItems);
}

function reviewMissingExpectedTraffic(summary: FeatureSummary): ReviewQueueItem[] {
    const expectedTraffic = summary.expected ?? getBuiltInScenario(summary.feature_id)?.expected;
    if (!expectedTraffic) {
        return [];
    }

    const items: ReviewQueueItem[] = [];
    for (const expected of expectedTraffic.http ?? []) {
        const observed = summary.traffic.some(
            (traffic) =>
                traffic.type === "http" &&
                traffic.method === expected.method &&
                traffic.route === `${expected.method} ${expected.route}` &&
                (!expected.step_id || traffic.step_id === expected.step_id) &&
                (traffic.attribution === "direct" || traffic.attribution === "probable"),
        );
        if (!observed) {
            items.push({
                feature_id: summary.feature_id,
                step_id: expected.step_id,
                reason: "scenario_expectation_failed",
                severity: "high",
                subject: `${expected.method} ${expected.route}`,
                detail: "Expected HTTP traffic was not observed as direct or probable.",
            });
        }
    }
    for (const expected of expectedTraffic.gateway ?? []) {
        const observed = summary.traffic.some(
            (traffic) =>
                traffic.type === "gateway" &&
                (!expected.direction || traffic.direction === expected.direction) &&
                (!expected.event || traffic.event === expected.event) &&
                (typeof expected.opcode === "undefined" || traffic.opcode === expected.opcode) &&
                (!expected.step_id || traffic.step_id === expected.step_id) &&
                (traffic.attribution === "direct" || traffic.attribution === "probable"),
        );
        if (!observed) {
            items.push({
                feature_id: summary.feature_id,
                step_id: expected.step_id,
                reason: "scenario_expectation_failed",
                severity: "high",
                subject: `Gateway ${expected.direction ?? "any"} ${expected.event ?? `opcode ${expected.opcode ?? "any"}`}`,
                detail: "Expected Gateway traffic was not observed as direct or probable.",
            });
        }
    }

    return items;
}

function reviewFailure(failure: RuntimeFailureArtifact): ReviewQueueItem {
    const abortReason = failure.error.abort_reason;
    return {
        feature_id: failure.feature_id,
        reason: abortReason ? "runtime_abort" : "runtime_failure",
        severity: "high",
        subject: abortReason ? `${failure.stage}: ${abortReason}` : `${failure.stage}: ${failure.error.name}`,
        detail: failure.error.message,
    };
}

function reviewTraffic(featureId: string, traffic: TrafficSummaryItem, routeCatalogKeys: Set<string>, gatewayEvents: Set<string>): ReviewQueueItem[] {
    const items: ReviewQueueItem[] = [];
    if (traffic.attribution === "unknown") {
        items.push({
            feature_id: featureId,
            step_id: traffic.step_id,
            reason: "unknown_attribution",
            severity: "medium",
            subject: trafficSubject(traffic),
        });
    }

    if (traffic.type === "http" && traffic.route) {
        if (!routeCatalogKeys.has(traffic.route)) {
            items.push({
                feature_id: featureId,
                step_id: traffic.step_id,
                reason: "new_route",
                severity: "high",
                subject: traffic.route,
            });
        }
        if (sensitiveRoutePattern.test(traffic.route) && traffic.attribution !== "background") {
            items.push({
                feature_id: featureId,
                step_id: traffic.step_id,
                reason: "sensitive_route",
                severity: "high",
                subject: traffic.route,
                detail: "Observed non-background traffic to a sensitive route family.",
            });
        }
    }

    if (traffic.type === "gateway" && traffic.event && !gatewayEvents.has(traffic.event)) {
        items.push({
            feature_id: featureId,
            step_id: traffic.step_id,
            reason: "new_gateway_event",
            severity: "high",
            subject: traffic.event,
        });
    }

    return items;
}

function trafficSubject(traffic: TrafficSummaryItem): string {
    if (traffic.type === "http") {
        return traffic.route ?? `${traffic.method ?? "HTTP"} unknown`;
    }

    return traffic.event ?? `opcode ${traffic.opcode ?? "unknown"}`;
}

function dedupe(items: ReviewQueueItem[]): ReviewQueueItem[] {
    const seen = new Set<string>();
    const output: ReviewQueueItem[] = [];
    for (const item of items) {
        const key = `${item.feature_id}:${item.step_id ?? ""}:${item.reason}:${item.subject}:${item.detail ?? ""}`;
        if (!seen.has(key)) {
            seen.add(key);
            output.push(item);
        }
    }

    return output;
}

function compareReviewItems(a: ReviewQueueItem, b: ReviewQueueItem): number {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity] || `${a.feature_id}:${a.reason}:${a.subject}`.localeCompare(`${b.feature_id}:${b.reason}:${b.subject}`);
}
