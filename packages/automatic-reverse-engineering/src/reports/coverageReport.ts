import { GatewayCoverageEntry, RouteCoverageEntry } from "../processors/coverage.js";

export function renderRouteCoverageMarkdown(entries: RouteCoverageEntry[]): string {
    const lines = ["# Route Coverage", ""];
    for (const entry of entries) {
        lines.push(`## ${entry.route}`);
        lines.push("");
        if (entry.catalog) {
            lines.push(`- catalog: ${entry.catalog.route_name} (${entry.catalog.source})`);
        }
        lines.push(`- methods: ${entry.methods_observed.join(", ") || "none"}`);
        lines.push(`- features: ${entry.feature_ids.join(", ") || "none"}`);
        lines.push(`- runs: ${observedRange(entry.first_observed_run_id, entry.last_observed_run_id)}`);
        lines.push(`- builds: ${observedRange(entry.first_observed_build, entry.last_observed_build)}`);
        lines.push(`- request shapes: ${entry.payload_shape_hashes.join(", ") || "none"}`);
        lines.push(`- response shapes: ${entry.response_shape_hashes.join(", ") || "none"}`);
        lines.push("");
    }

    return `${lines.join("\n").trimEnd()}\n`;
}

export function renderGatewayCoverageMarkdown(entries: GatewayCoverageEntry[]): string {
    const lines = ["# Gateway Coverage", ""];
    for (const entry of entries) {
        lines.push(`## ${entry.event ?? `opcode ${entry.opcode ?? "unknown"}`}`);
        lines.push("");
        if (entry.catalog) {
            lines.push(`- catalog: ${entry.catalog.name ?? "unnamed"} (${entry.catalog.source})`);
        }
        lines.push(`- directions: ${entry.directions.join(", ") || "none"}`);
        lines.push(`- features: ${entry.feature_ids.join(", ") || "none"}`);
        lines.push(`- runs: ${observedRange(entry.first_observed_run_id, entry.last_observed_run_id)}`);
        lines.push(`- builds: ${observedRange(entry.first_observed_build, entry.last_observed_build)}`);
        lines.push(`- payload shapes: ${entry.payload_shape_hashes.join(", ") || "none"}`);
        lines.push("");
    }

    return `${lines.join("\n").trimEnd()}\n`;
}

function observedRange(first: string | undefined, last: string | undefined): string {
    if (!first && !last) {
        return "none";
    }
    if (first && first === last) {
        return first;
    }
    return `${first ?? "unknown"} -> ${last ?? "unknown"}`;
}
