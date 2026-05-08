import { readFile } from "node:fs/promises";
import path from "node:path";

import { AssetSnapshot, ExperimentCandidate, FeatureSummary, StaticCandidate, TrafficSummaryItem } from "../types.js";
import { sha256 } from "../util/hash.js";
import { cloneJson, isRecord } from "../util/json.js";
import { DecodedSourceMap, OriginalSourcePosition, decodeSourceMap, originalPositionFor } from "./sourceMap.js";

export interface StaticCandidateOptions {
    staticDir: string;
    assets: AssetSnapshot[];
    maxBytesPerAsset?: number;
    experiments?: unknown[];
}

export async function attachStaticCandidates(summary: FeatureSummary, options: StaticCandidateOptions): Promise<FeatureSummary> {
    const cloned = cloneJson(summary);
    const searchableAssets = options.assets.filter((asset) => asset.kind === "script" && asset.local_path);
    const sourceMapsByAssetUrl = await sourceMapsForAssets(options.staticDir, options.assets, options.maxBytesPerAsset ?? 5_000_000);
    const sourceTexts = await Promise.all(
        searchableAssets.map(async (asset) => ({
            asset,
            text: await readSearchableAsset(options.staticDir, asset, options.maxBytesPerAsset ?? 5_000_000),
            sourceMap: sourceMapsByAssetUrl.get(asset.url),
        })),
    );

    cloned.traffic = cloned.traffic.map((item) => ({
        ...item,
        static_candidates: candidatesForItem(item, sourceTexts),
    }));
    cloned.traffic = cloned.traffic.map((item) => ({
        ...item,
        experiment_candidates: experimentCandidatesForItem(item, options.experiments),
    }));

    return cloned;
}

function experimentCandidatesForItem(item: TrafficSummaryItem, experiments: unknown[] | undefined): ExperimentCandidate[] | undefined {
    if (!experiments?.length || !item.static_candidates?.length) {
        return undefined;
    }

    const candidates = experiments.flatMap(
        (entry) =>
            item.static_candidates
                ?.map((candidate) => normalizeExperimentCandidate(entry, candidate))
                .filter((candidate): candidate is ExperimentCandidate => Boolean(candidate)) ?? [],
    );
    const deduped = dedupeExperimentCandidates(candidates);
    return deduped.length > 0 ? deduped.slice(0, 10) : undefined;
}

const experimentProximityWindowBytes = 500;

function normalizeExperimentCandidate(entry: unknown, staticCandidate: StaticCandidate): ExperimentCandidate | undefined {
    if (!isRecord(entry) || typeof entry.source !== "string" || typeof entry.context_hash !== "string" || entry.source !== staticCandidate.chunk) {
        return undefined;
    }

    const sourceOffset = typeof entry.source_offset === "number" ? entry.source_offset : typeof entry.offset === "number" ? entry.offset : undefined;
    const moduleId = typeof entry.module_id === "string" ? entry.module_id : undefined;
    const confidence = experimentConfidence(staticCandidate, moduleId, sourceOffset);
    if (!confidence) {
        return undefined;
    }

    if (typeof entry.key === "string" && typeof entry.value === "string") {
        return {
            source: entry.source,
            context_hash: entry.context_hash,
            confidence,
            module_id: moduleId,
            source_offset: sourceOffset,
            key: entry.key,
            value: entry.value,
        };
    }

    return {
        source: entry.source,
        context_hash: entry.context_hash,
        confidence,
        module_id: moduleId,
        source_offset: sourceOffset,
        id: typeof entry.id === "string" ? entry.id : undefined,
        label: typeof entry.label === "string" ? entry.label : undefined,
        hash: typeof entry.hash === "number" ? entry.hash : undefined,
        config_keys: Array.isArray(entry.config_keys) ? entry.config_keys.filter((item): item is string => typeof item === "string") : undefined,
    };
}

function experimentConfidence(staticCandidate: StaticCandidate, moduleId: string | undefined, sourceOffset: number | undefined): ExperimentCandidate["confidence"] | undefined {
    if (staticCandidate.module_id && moduleId) {
        return staticCandidate.module_id === moduleId ? "medium" : undefined;
    }

    if (
        typeof staticCandidate.generated_offset === "number" &&
        typeof sourceOffset === "number" &&
        Math.abs(staticCandidate.generated_offset - sourceOffset) <= experimentProximityWindowBytes
    ) {
        return "medium";
    }

    if (typeof moduleId === "undefined" && typeof sourceOffset === "undefined" && staticCandidate.confidence === "high" && staticCandidate.chunk) {
        return "low";
    }

    return undefined;
}

function dedupeExperimentCandidates(candidates: ExperimentCandidate[]): ExperimentCandidate[] {
    const seen = new Set<string>();
    const output: ExperimentCandidate[] = [];
    for (const candidate of candidates) {
        const key = `${candidate.source}:${candidate.context_hash}:${candidate.key ?? candidate.id ?? ""}:${candidate.value ?? candidate.label ?? ""}`;
        if (!seen.has(key)) {
            seen.add(key);
            output.push(candidate);
        }
    }
    return output.sort(compareExperimentCandidates);
}

function compareExperimentCandidates(a: ExperimentCandidate, b: ExperimentCandidate): number {
    const confidenceOrder = { medium: 0, low: 1 } satisfies Record<ExperimentCandidate["confidence"], number>;
    return (
        confidenceOrder[a.confidence] - confidenceOrder[b.confidence] ||
        `${a.source}:${a.module_id ?? ""}:${a.source_offset ?? Number.MAX_SAFE_INTEGER}:${a.key ?? a.id ?? ""}:${a.value ?? a.label ?? ""}`.localeCompare(
            `${b.source}:${b.module_id ?? ""}:${b.source_offset ?? Number.MAX_SAFE_INTEGER}:${b.key ?? b.id ?? ""}:${b.value ?? b.label ?? ""}`,
        )
    );
}

function candidatesForItem(
    item: TrafficSummaryItem,
    sourceTexts: Array<{ asset: AssetSnapshot; text: string | undefined; sourceMap: DecodedSourceMap | undefined }>,
): StaticCandidate[] | undefined {
    const candidates: StaticCandidate[] = [];
    for (const { asset, text, sourceMap } of sourceTexts) {
        if (!text && !sourceMap) {
            continue;
        }

        const stackMatch = stackMatchForItem(item, asset, text, sourceMap);
        if (stackMatch) {
            candidates.push(stackMatch);
            continue;
        }

        if (!text) {
            continue;
        }

        const match = matchForItem(item, text);
        if (match) {
            candidates.push({
                chunk: asset.file_name,
                module_id: moduleIdForOffset(text, match.offset),
                generated_offset: match.offset,
                confidence: match.confidence,
            });
        }
    }

    return candidates.length > 0 ? candidates : undefined;
}

function stackMatchForItem(item: TrafficSummaryItem, asset: AssetSnapshot, text: string | undefined, sourceMap: DecodedSourceMap | undefined): StaticCandidate | undefined {
    const frame = item.initiator_frames?.find((candidate) => frameMatchesAsset(candidate, asset));
    if (!frame) {
        return undefined;
    }

    const offset = text ? offsetForLineColumn(text, frame.line_number, frame.column_number) : undefined;
    const mapped = sourceMap ? originalPositionFor(sourceMap, frame.line_number, frame.column_number) : undefined;
    const sourceContext = sourceMap && mapped ? sourceContextForPosition(sourceMap, mapped) : undefined;
    return {
        chunk: asset.file_name,
        module_id: text && typeof offset === "number" ? moduleIdForOffset(text, offset) : undefined,
        stack_hash: item.initiator_stack_hash,
        generated_offset: offset,
        line_number: frame.line_number,
        column_number: frame.column_number,
        source_file: mapped?.source,
        source_name: mapped?.name,
        source_line_number: mapped?.original_line,
        source_column_number: mapped?.original_column,
        source_context: sourceContext?.source_context,
        source_context_hash: sourceContext?.source_context_hash,
        source_context_truncated: sourceContext?.source_context_truncated,
        confidence: "high",
    };
}

interface SourceContext {
    source_context?: string;
    source_context_hash: string;
    source_context_truncated?: boolean;
}

const maxSourceContextChars = 180;
const maxSourceContextLines = 3;

function sourceContextForPosition(sourceMap: DecodedSourceMap, position: OriginalSourcePosition): SourceContext | undefined {
    const sourceText = sourceMap.sourcesContent?.[position.source_index];
    if (!sourceText) {
        return undefined;
    }

    const lines = sourceText.split(/\r?\n/);
    const start = Math.max(0, position.original_line - 1);
    const end = Math.min(lines.length, start + maxSourceContextLines);
    const rawWindow = lines.slice(start, end).join("\n");
    const sanitizedWindow = sanitizeSourceContextWindow(rawWindow);
    if (!sanitizedWindow) {
        return undefined;
    }

    const truncated = sanitizedWindow.length > maxSourceContextChars;
    const hashInput = truncated ? sanitizedWindow.slice(0, maxSourceContextChars) : sanitizedWindow;
    const sourceContext = identifierContext(sanitizedWindow, position.name);
    return {
        source_context: sourceContext,
        source_context_hash: sha256(hashInput),
        source_context_truncated: truncated,
    };
}

function sanitizeSourceContextWindow(value: string): string {
    return value
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/.*$/gm, " ")
        .replace(/`(?:\\.|[^`\\])*`/g, "{string}")
        .replace(/"(?:\\.|[^"\\])*"/g, "{string}")
        .replace(/'(?:\\.|[^'\\])*'/g, "{string}")
        .replace(/\bhttps?:\/\/[^\s"'`<>)]+/gi, "{url}")
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "{email}")
        .replace(/\bmfa\.[A-Za-z0-9_-]+/g, "{token}")
        .replace(/\b\d{17,20}\b/g, "{snowflake}")
        .replace(/\b\d+(?:\.\d+)?\b/g, "{number}")
        .replace(/\s+/g, " ")
        .trim();
}

function identifierContext(sanitizedWindow: string, sourceName: string | undefined): string | undefined {
    const candidates = [
        [/\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/, "function"],
        [/\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/, "class"],
        [/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/, "binding"],
        [/\b([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?\([^)]*\)\s*=>/, "function"],
    ] as const;

    for (const [pattern, kind] of candidates) {
        const match = pattern.exec(sanitizedWindow);
        if (match?.[1]) {
            return `${kind} ${match[1]}`;
        }
    }

    return sourceName && /^[A-Za-z_$][\w$]*$/.test(sourceName) ? `name ${sourceName}` : undefined;
}

interface StaticMatch {
    confidence: StaticCandidate["confidence"];
    offset: number;
}

function matchForItem(item: TrafficSummaryItem, text: string): StaticMatch | undefined {
    if (item.type === "gateway" && item.event) {
        const offset = text.indexOf(item.event);
        return offset === -1 ? undefined : { confidence: "high", offset };
    }

    if (item.type !== "http" || !item.route) {
        return undefined;
    }

    const route = item.route.replace(/^[A-Z]+\s+/, "");
    const exactOffset = text.indexOf(route);
    if (exactOffset !== -1) {
        return { confidence: "high", offset: exactOffset };
    }

    const literals = route.split("/").filter((part) => part && !part.startsWith("{"));
    const orderedOffset = literals.length >= 2 ? containsInOrder(text, literals) : undefined;
    if (typeof orderedOffset === "number") {
        return { confidence: "medium", offset: orderedOffset };
    }

    return undefined;
}

async function readSearchableAsset(staticDir: string, asset: AssetSnapshot, maxBytes: number): Promise<string | undefined> {
    if (!asset.local_path || (typeof asset.bytes === "number" && asset.bytes > maxBytes)) {
        return undefined;
    }

    try {
        return await readFile(path.join(staticDir, asset.local_path), "utf8");
    } catch {
        return undefined;
    }
}

async function sourceMapsForAssets(staticDir: string, assets: AssetSnapshot[], maxBytes: number): Promise<Map<string, DecodedSourceMap>> {
    const output = new Map<string, DecodedSourceMap>();
    const sourceMapAssets = assets.filter((asset) => asset.kind === "other" && asset.local_path && /\.map(?:$|\?)/i.test(asset.url));
    for (const asset of sourceMapAssets) {
        const decoded = await readSourceMapAsset(staticDir, asset, maxBytes);
        if (!decoded) {
            continue;
        }

        const scriptUrl = sourceMapScriptUrl(asset);
        if (scriptUrl) {
            output.set(scriptUrl, decoded);
        }
    }

    return output;
}

async function readSourceMapAsset(staticDir: string, asset: AssetSnapshot, maxBytes: number): Promise<DecodedSourceMap | undefined> {
    const text = await readSearchableAsset(staticDir, asset, maxBytes);
    if (!text) {
        return undefined;
    }

    try {
        return decodeSourceMap(JSON.parse(text) as unknown);
    } catch {
        return undefined;
    }
}

function sourceMapScriptUrl(asset: AssetSnapshot): string | undefined {
    if (asset.discovered_from) {
        return asset.discovered_from;
    }

    try {
        const url = new URL(asset.url);
        if (!url.pathname.endsWith(".map")) {
            return undefined;
        }
        url.pathname = url.pathname.slice(0, -4);
        url.search = "";
        url.hash = "";
        return url.toString();
    } catch {
        return undefined;
    }
}

function containsInOrder(text: string, literals: string[]): number | undefined {
    let offset = 0;
    let firstOffset: number | undefined;
    for (const literal of literals) {
        const index = text.indexOf(literal, offset);
        if (index === -1) {
            return undefined;
        }

        firstOffset ??= index;
        offset = index + literal.length;
    }

    return firstOffset;
}

function frameMatchesAsset(frame: NonNullable<TrafficSummaryItem["initiator_frames"]>[number], asset: AssetSnapshot): boolean {
    if (frame.url === asset.url) {
        return true;
    }

    return Boolean(frame.file_name && frame.file_name === asset.file_name);
}

function offsetForLineColumn(text: string, lineNumber: number | undefined, columnNumber: number | undefined): number | undefined {
    if (typeof lineNumber !== "number" || lineNumber < 0) {
        return undefined;
    }

    let offset = 0;
    for (let line = 0; line < lineNumber; line += 1) {
        const next = text.indexOf("\n", offset);
        if (next === -1) {
            return undefined;
        }
        offset = next + 1;
    }

    return Math.min(offset + Math.max(columnNumber ?? 0, 0), text.length);
}

function moduleIdForOffset(text: string, offset: number): string | undefined {
    const modulePattern = /(?:^|[,{]\s*|\/\*\*\*\/\s*)["']?([A-Za-z0-9_$.-]{1,100})["']?\s*:\s*(?:function\s*\(|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g;
    let match: RegExpExecArray | null;
    let moduleId: string | undefined;
    while ((match = modulePattern.exec(text)) !== null) {
        if (match.index > offset) {
            break;
        }

        moduleId = match[1];
    }

    return moduleId;
}
