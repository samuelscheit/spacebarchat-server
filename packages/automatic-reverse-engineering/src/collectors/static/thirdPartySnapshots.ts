import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { GatewayCatalog, GatewayEventCatalogEntry, GatewayOpcodeCatalogEntry, HttpMethod, RouteCatalogEntry } from "../../types.js";
import { isRecord, stableStringify } from "../../util/json.js";
import { sha256 } from "../../util/hash.js";

export interface XhyromExperimentCatalogEntry {
    id?: string;
    kind?: string;
    label?: string;
    hash?: number;
    buckets?: number[];
    config_keys?: string[];
    description?: string[];
    rollout?: {
        revision?: number;
        population_count: number;
        override_bucket_count: number;
        override_id_count: number;
        formatted_override_population_count: number;
    };
    source: string;
    context_hash: string;
}

export interface UserdoccersDocument {
    path: string;
    content: string;
}

export interface UserdoccersGatewaySources {
    gatewayEvents: string;
    opcodes: string;
}

export interface ThirdPartyImportOptions {
    source?: string;
}

const httpMethods = new Set<HttpMethod>(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);

export function importXhyromRouteCatalog(input: unknown, options: ThirdPartyImportOptions = {}): RouteCatalogEntry[] {
    if (!isRecord(input)) {
        throw new Error("xHyroM routes snapshot must be an object keyed by route name");
    }

    const source = options.source ?? "xhyrom:data/client/routes.json";
    const entries: RouteCatalogEntry[] = [];
    for (const [routeName, value] of Object.entries(input)) {
        if (!isRecord(value) || typeof value.url !== "string") {
            continue;
        }

        const methods = Array.isArray(value.allowed_methods)
            ? value.allowed_methods.filter((method): method is HttpMethod => typeof method === "string" && httpMethods.has(method as HttpMethod))
            : [];
        for (const method of methods) {
            entries.push({
                method,
                route: normalizeDiscordRoutePattern(value.url),
                route_name: routeName,
                source,
            });
        }
    }

    return dedupeRoutes(entries);
}

export function importXhyromExperimentCatalog(input: unknown, options: ThirdPartyImportOptions = {}): XhyromExperimentCatalogEntry[] {
    if (!Array.isArray(input)) {
        throw new Error("xHyroM experiments snapshot must be an array");
    }

    const source = options.source ?? "xhyrom:data/client/experiments/experiments.json";
    return input
        .map((item) => normalizeXhyromExperiment(item, source))
        .filter((item): item is XhyromExperimentCatalogEntry => Boolean(item))
        .sort((a, b) => `${a.id ?? ""}:${a.hash ?? ""}:${a.label ?? ""}`.localeCompare(`${b.id ?? ""}:${b.hash ?? ""}:${b.label ?? ""}`));
}

export async function readUserdoccersMdxDocuments(root: string): Promise<UserdoccersDocument[]> {
    const files = await walkFiles(root);
    const documents = await Promise.all(
        files
            .filter((filePath) => filePath.endsWith(".mdx"))
            .map(async (filePath) => ({
                path: path.relative(root, filePath).split(path.sep).join(path.posix.sep),
                content: await readFile(filePath, "utf8"),
            })),
    );
    return documents.sort((a, b) => a.path.localeCompare(b.path));
}

export function importUserdoccersRouteCatalog(documents: UserdoccersDocument[], options: ThirdPartyImportOptions = {}): RouteCatalogEntry[] {
    const sourcePrefix = options.source ?? "userdoccers";
    const entries: RouteCatalogEntry[] = [];
    for (const document of documents) {
        for (const routeHeader of document.content.matchAll(/<RouteHeader\b([\s\S]*?)>([\s\S]*?)<\/RouteHeader>/g)) {
            const method = propValue(routeHeader[1], "method");
            const url = propValue(routeHeader[1], "url");
            if (!method || !url || !httpMethods.has(method as HttpMethod)) {
                continue;
            }

            const route = normalizeDiscordRoutePattern(url);
            entries.push({
                method: method as HttpMethod,
                route,
                route_name: routeNameFor(method as HttpMethod, route),
                source: `${sourcePrefix}:${document.path}`,
                summary: cleanMdxText(routeHeader[2]),
            });
        }
    }

    return dedupeRoutes(entries);
}

export function importUserdoccersGatewayCatalog(sources: UserdoccersGatewaySources, options: ThirdPartyImportOptions = {}): GatewayCatalog {
    const source = options.source ?? "userdoccers";
    return {
        opcodes: parseUserdoccersGatewayOpcodes(sources.opcodes, `${source}:pages/gateway/opcodes-and-close-codes.mdx`),
        events: parseUserdoccersDispatchEvents(sources.gatewayEvents, `${source}:pages/gateway/gateway-events.mdx`),
    };
}

function normalizeXhyromExperiment(item: unknown, source: string): XhyromExperimentCatalogEntry | undefined {
    if (!isRecord(item) || !isRecord(item.data)) {
        return undefined;
    }

    const data = item.data;
    const rollout = isRecord(item.rollout) ? item.rollout : undefined;
    const normalized: XhyromExperimentCatalogEntry = {
        id: stringField(data.id),
        kind: stringField(data.kind),
        label: stringField(data.label),
        hash: numberField(data.hash),
        buckets: numberArrayField(data.buckets),
        config_keys: stringArrayField(data.config_keys),
        description: stringArrayField(data.description),
        rollout: rollout ? summarizeRollout(rollout) : undefined,
        source,
        context_hash: "",
    };
    normalized.context_hash = sha256(stableStringify(normalized));
    return normalized;
}

function summarizeRollout(rollout: Record<string, unknown>): XhyromExperimentCatalogEntry["rollout"] {
    const overrideIdCount = isRecord(rollout.overrides) ? Object.values(rollout.overrides).reduce<number>((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0) : 0;
    return {
        revision: numberField(rollout.revision),
        population_count: Array.isArray(rollout.populations) ? rollout.populations.length : 0,
        override_bucket_count: isRecord(rollout.overrides) ? Object.keys(rollout.overrides).length : 0,
        override_id_count: overrideIdCount,
        formatted_override_population_count: Array.isArray(rollout.overrides_formatted) ? rollout.overrides_formatted.length : 0,
    };
}

function parseUserdoccersGatewayOpcodes(sourceText: string, source: string): GatewayOpcodeCatalogEntry[] {
    const section = sectionBetween(sourceText, "###### Gateway Opcodes", "###### Gateway Close Event Codes");
    const entries: GatewayOpcodeCatalogEntry[] = [];
    for (const row of markdownTableRows(section)) {
        const opcode = Number(stripMarkdown(row[0]));
        if (!Number.isInteger(opcode)) {
            continue;
        }

        entries.push({
            opcode,
            name: stripMarkdown(row[1]).replace(/\s+\(deprecated\)$/i, ""),
            direction: directionFromUserdoccersAction(stripMarkdown(row[2])),
            source,
        });
    }

    return dedupeOpcodes(entries);
}

function parseUserdoccersDispatchEvents(sourceText: string, source: string): GatewayEventCatalogEntry[] {
    const section = sectionBetween(sourceText, "## Dispatch Events", "#### Ready");
    const entries: GatewayEventCatalogEntry[] = [];
    for (const row of markdownTableRows(section)) {
        const title = markdownLinkText(row[0]);
        if (!title) {
            continue;
        }

        entries.push({
            event: eventConstantFromTitle(title),
            name: title,
            direction: "received",
            source,
        });
    }

    return dedupeEvents(entries);
}

function normalizeDiscordRoutePattern(input: string): string {
    const pathname = routePathname(input);
    const parts = pathname
        .replace(/^\/api\/v\d+(?=\/)/, "")
        .split("/")
        .filter(Boolean);
    const normalized = parts.map((part, index) => normalizeRoutePart(part, parts[index - 1]));
    return `/${normalized.join("/")}`;
}

function routePathname(input: string): string {
    try {
        return new URL(input).pathname;
    } catch {
        return input.startsWith("/") ? input : `/${input}`;
    }
}

function normalizeRoutePart(part: string, previousPart: string | undefined): string {
    const decoded = safeDecode(part);
    if (decoded.startsWith(":")) {
        return placeholderForPreviousPart(previousPart) ?? "{param}";
    }

    const variable = /^\{(.+)\}$/.exec(decoded)?.[1];
    if (variable) {
        return `{${normalizeVariableName(variable)}}`;
    }

    return decoded;
}

function normalizeVariableName(variable: string): string {
    return variable
        .replace(/\./g, "_")
        .replace(/[^a-zA-Z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
}

function placeholderForPreviousPart(previousPart: string | undefined): string | undefined {
    switch (previousPart) {
        case "channels":
            return "{channel_id}";
        case "guilds":
            return "{guild_id}";
        case "messages":
        case "pins":
        case "polls":
            return "{message_id}";
        case "users":
        case "recipients":
        case "members":
            return "{user_id}";
        case "roles":
            return "{role_id}";
        case "applications":
        case "application-directory":
        case "oauth2":
            return "{application_id}";
        case "webhooks":
            return "{webhook_id}";
        case "emojis":
        case "emoji":
            return "{emoji_id}";
        case "stickers":
            return "{sticker_id}";
        case "attachments":
            return "{attachment_id}";
        case "invites":
            return "{invite_code}";
        default:
            return undefined;
    }
}

function propValue(props: string, name: string): string | undefined {
    const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(props);
    return match?.[1] ?? match?.[2];
}

function markdownTableRows(section: string): string[][] {
    const rows: string[][] = [];
    for (const line of section.split(/\r?\n/)) {
        if (!line.trim().startsWith("|") || /^\\?\|\s*-+/.test(line.trim()) || /\|\s*Code\s*\|/.test(line) || /\|\s*Name\s*\|/.test(line)) {
            continue;
        }

        const cells = line
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim());
        if (cells.length > 1) {
            rows.push(cells);
        }
    }
    return rows;
}

function sectionBetween(sourceText: string, startMarker: string, endMarker: string): string {
    const start = sourceText.indexOf(startMarker);
    if (start < 0) {
        return "";
    }

    const end = sourceText.indexOf(endMarker, start + startMarker.length);
    return sourceText.slice(start + startMarker.length, end >= 0 ? end : undefined);
}

function markdownLinkText(value: string): string | undefined {
    const link = /\[([^\]]+)]\((?:<[^>]+>|[^)]+)\)/.exec(value);
    return link ? stripMarkdown(link[1]) : undefined;
}

function eventConstantFromTitle(title: string): string {
    return title
        .replace(/\s+\((?:send|receive)\)$/i, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase();
}

function routeNameFor(method: HttpMethod, route: string): string {
    const tokens = route
        .split("/")
        .filter(Boolean)
        .map((part) =>
            part
                .replace(/[{}]/g, "")
                .replace(/[^a-zA-Z0-9]+/g, "_")
                .toUpperCase(),
        );
    return `${method}_${tokens.join("_") || "ROOT"}`;
}

function directionFromUserdoccersAction(action: string): "sent" | "received" | "both" | "unknown" {
    const normalized = action.toLowerCase();
    if (normalized.includes("send") && normalized.includes("receive")) {
        return "both";
    }
    if (normalized.includes("send")) {
        return "sent";
    }
    if (normalized.includes("receive")) {
        return "received";
    }
    return "unknown";
}

function stripMarkdown(value: string): string {
    return value
        .replace(/\\\|/g, "|")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .replace(/\^.+?\^/g, "")
        .trim();
}

function cleanMdxText(value: string): string | undefined {
    const text = stripMarkdown(value)
        .replace(/<[^>]+>/g, " ")
        .replace(/\{[^}]+}/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > 0 ? text : undefined;
}

function dedupeRoutes(entries: RouteCatalogEntry[]): RouteCatalogEntry[] {
    const seen = new Set<string>();
    const output: RouteCatalogEntry[] = [];
    for (const entry of entries.sort((a, b) => `${a.route} ${a.method} ${a.route_name}`.localeCompare(`${b.route} ${b.method} ${b.route_name}`))) {
        const key = `${entry.method} ${entry.route} ${entry.source}`;
        if (!seen.has(key)) {
            seen.add(key);
            output.push(entry);
        }
    }
    return output;
}

function dedupeOpcodes(entries: GatewayOpcodeCatalogEntry[]): GatewayOpcodeCatalogEntry[] {
    const seen = new Set<number>();
    const output: GatewayOpcodeCatalogEntry[] = [];
    for (const entry of entries.sort((a, b) => a.opcode - b.opcode)) {
        if (!seen.has(entry.opcode)) {
            seen.add(entry.opcode);
            output.push(entry);
        }
    }
    return output;
}

function dedupeEvents(entries: GatewayEventCatalogEntry[]): GatewayEventCatalogEntry[] {
    const seen = new Set<string>();
    const output: GatewayEventCatalogEntry[] = [];
    for (const entry of entries.sort((a, b) => a.event.localeCompare(b.event))) {
        if (!seen.has(entry.event)) {
            seen.add(entry.event);
            output.push(entry);
        }
    }
    return output;
}

async function walkFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(root, entry.name);
            if (entry.isDirectory()) {
                return walkFiles(entryPath);
            }
            return [entryPath];
        }),
    );
    return files.flat();
}

function stringField(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberField(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArrayField(value: unknown): string[] | undefined {
    const values = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return values.length > 0 ? values : undefined;
}

function numberArrayField(value: unknown): number[] | undefined {
    const values = Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
    return values.length > 0 ? values : undefined;
}

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}
