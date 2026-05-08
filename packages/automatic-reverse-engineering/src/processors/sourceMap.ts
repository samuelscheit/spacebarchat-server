import { isRecord } from "../util/json.js";
import { redactText } from "./redact.js";

export interface DecodedSourceMap {
    version?: number;
    file?: string;
    sourceRoot?: string;
    sources: string[];
    sourcesContent?: Array<string | undefined>;
    names: string[];
    lines: SourceMapSegment[][];
}

export interface SourceMapSegment {
    generated_line: number;
    generated_column: number;
    source_index?: number;
    original_line?: number;
    original_column?: number;
    name_index?: number;
}

export interface OriginalSourcePosition {
    source: string;
    source_index: number;
    name?: string;
    generated_line: number;
    generated_column: number;
    original_line: number;
    original_column: number;
}

const base64Digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const base64Values = new Map(Array.from(base64Digits, (digit, index) => [digit, index]));

export function decodeSourceMap(input: unknown): DecodedSourceMap | undefined {
    if (!isRecord(input) || typeof input.mappings !== "string" || !Array.isArray(input.sources)) {
        return undefined;
    }

    const rawSourcesContent = Array.isArray(input.sourcesContent) ? input.sourcesContent : undefined;
    const sources: string[] = [];
    const sourcesContent: Array<string | undefined> | undefined = rawSourcesContent ? [] : undefined;
    for (const [index, source] of input.sources.entries()) {
        if (typeof source !== "string") {
            continue;
        }
        sources.push(source);
        sourcesContent?.push(typeof rawSourcesContent?.[index] === "string" ? rawSourcesContent[index] : undefined);
    }

    return {
        version: typeof input.version === "number" ? input.version : undefined,
        file: typeof input.file === "string" ? input.file : undefined,
        sourceRoot: typeof input.sourceRoot === "string" ? input.sourceRoot : undefined,
        sources,
        sourcesContent,
        names: Array.isArray(input.names) ? input.names.filter((name): name is string => typeof name === "string") : [],
        lines: decodeMappings(input.mappings),
    };
}

export function originalPositionFor(sourceMap: DecodedSourceMap, generatedLine: number | undefined, generatedColumn: number | undefined): OriginalSourcePosition | undefined {
    if (typeof generatedLine !== "number" || typeof generatedColumn !== "number" || generatedLine < 0 || generatedColumn < 0) {
        return undefined;
    }

    const line = sourceMap.lines[generatedLine];
    if (!line) {
        return undefined;
    }

    let selected: SourceMapSegment | undefined;
    for (const segment of line) {
        if (segment.generated_column > generatedColumn) {
            break;
        }
        if (typeof segment.source_index === "number") {
            selected = segment;
        }
    }

    if (!selected || typeof selected.source_index !== "number" || typeof selected.original_line !== "number" || typeof selected.original_column !== "number") {
        return undefined;
    }

    const source = sourceMap.sources[selected.source_index];
    if (!source) {
        return undefined;
    }

    const name = typeof selected.name_index === "number" ? sourceMap.names[selected.name_index] : undefined;
    return {
        source: sourceWithRoot(sourceMap.sourceRoot, source),
        source_index: selected.source_index,
        name: safeSourceName(name),
        generated_line: selected.generated_line,
        generated_column: selected.generated_column,
        original_line: selected.original_line,
        original_column: selected.original_column,
    };
}

function decodeMappings(mappings: string): SourceMapSegment[][] {
    const lines: SourceMapSegment[][] = [];
    let previousSource = 0;
    let previousOriginalLine = 0;
    let previousOriginalColumn = 0;
    let previousName = 0;

    for (const [generatedLine, rawLine] of mappings.split(";").entries()) {
        const segments: SourceMapSegment[] = [];
        let previousGeneratedColumn = 0;
        for (const rawSegment of rawLine.split(",")) {
            if (!rawSegment) {
                continue;
            }

            const values = decodeVlq(rawSegment);
            if (values.length === 0) {
                continue;
            }

            previousGeneratedColumn += values[0];
            const segment: SourceMapSegment = {
                generated_line: generatedLine,
                generated_column: previousGeneratedColumn,
            };
            if (values.length >= 4) {
                previousSource += values[1];
                previousOriginalLine += values[2];
                previousOriginalColumn += values[3];
                segment.source_index = previousSource;
                segment.original_line = previousOriginalLine;
                segment.original_column = previousOriginalColumn;
            }
            if (values.length >= 5) {
                previousName += values[4];
                segment.name_index = previousName;
            }
            segments.push(segment);
        }
        lines.push(segments);
    }

    return lines;
}

function decodeVlq(segment: string): number[] {
    const values: number[] = [];
    let value = 0;
    let shift = 0;

    for (const char of segment) {
        const digit = base64Values.get(char);
        if (typeof digit === "undefined") {
            return values;
        }

        const continuation = Boolean(digit & 32);
        value += (digit & 31) << shift;
        if (continuation) {
            shift += 5;
            continue;
        }

        values.push(fromVlqSigned(value));
        value = 0;
        shift = 0;
    }

    return values;
}

function fromVlqSigned(value: number): number {
    const negative = Boolean(value & 1);
    const shifted = value >> 1;
    return negative ? -shifted : shifted;
}

function sourceWithRoot(sourceRoot: string | undefined, source: string): string {
    const normalizedSource = stripQueryAndHash(source);
    if (!sourceRoot || /^(?:[a-z]+:)?\/\//i.test(normalizedSource) || normalizedSource.startsWith("webpack://")) {
        return sanitizeSourceReference(normalizedSource);
    }

    return sanitizeSourceReference(`${stripQueryAndHash(sourceRoot).replace(/\/+$/, "")}/${normalizedSource.replace(/^\.?\//, "")}`);
}

function stripQueryAndHash(source: string): string {
    const hashIndex = source.indexOf("#");
    const queryIndex = source.indexOf("?");
    const stop = [hashIndex, queryIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    return typeof stop === "number" ? source.slice(0, stop) : source;
}

const maxSourceReferenceSegments = 4;

function sanitizeSourceReference(source: string): string {
    const normalized = redactText(source.replace(/\\/g, "/")).replace(/([^:])\/{2,}/g, "$1/");
    const urlMatch = /^([a-z][a-z0-9+.-]*:\/\/)([^/]*)(\/.*)?$/i.exec(normalized);
    if (!urlMatch) {
        return compactPath(normalized);
    }

    const [, scheme, authority, rest = ""] = urlMatch;
    const safeAuthority = redactText(authority);
    const compactedRest = compactPath(rest);
    if (!compactedRest || compactedRest === "/") {
        return `${scheme}${safeAuthority}`;
    }

    return `${scheme}${safeAuthority}${compactedRest.startsWith("/") ? "" : "/"}${compactedRest}`;
}

function compactPath(sourcePath: string): string {
    const hasLeadingSlash = sourcePath.startsWith("/");
    const segments = sourcePath.split("/").filter((segment) => segment && segment !== ".");
    if (segments.length === 0) {
        return hasLeadingSlash ? "/" : "";
    }

    const compacted = segments.length > maxSourceReferenceSegments ? ["...", ...segments.slice(-maxSourceReferenceSegments)] : segments;
    return `${hasLeadingSlash && compacted[0] !== "..." ? "/" : ""}${compacted.join("/")}`;
}

function safeSourceName(name: string | undefined): string | undefined {
    if (!name) {
        return undefined;
    }

    const redacted = redactText(name).trim();
    if (!redacted) {
        return undefined;
    }

    return redacted.length > 120 ? `${redacted.slice(0, 120)}...` : redacted;
}
