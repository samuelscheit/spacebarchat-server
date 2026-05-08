import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeRoutePattern } from "../../processors/normalize.js";
import { HttpMethod, RouteCatalogEntry } from "../../types.js";

const routeCallPattern = /router\.(get|post|put|patch|delete|options|head)\s*\(\s*["']([^"']*)["']/g;

export interface SourceRouteCatalogOptions {
    source?: string;
}

export async function importExpressSourceRouteCatalog(routesRoot: string, options: SourceRouteCatalogOptions = {}): Promise<RouteCatalogEntry[]> {
    const files = await routeFiles(routesRoot);
    const entries: RouteCatalogEntry[] = [];
    for (const filePath of files) {
        const text = await readFile(filePath, "utf8");
        const baseRoute = baseRouteFromFile(routesRoot, filePath);
        const matches = Array.from(text.matchAll(routeCallPattern));
        for (let index = 0; index < matches.length; index += 1) {
            const match = matches[index];
            const method = match[1].toUpperCase() as HttpMethod;
            const suffix = match[2];
            const segmentEnd = matches[index + 1]?.index ?? text.length;
            const segment = text.slice(match.index, segmentEnd);
            const route = normalizeRoutePattern(joinRoute(baseRoute, suffix));
            entries.push({
                method,
                route,
                route_name: routeName(method, route),
                source: options.source ?? path.relative(process.cwd(), filePath),
                request_schema_ref: extractString(segment, /requestBody\s*:\s*"([^"]+)"/),
                response_schema_refs: extractResponseRefs(segment),
            });
        }
    }

    return dedupe(entries).sort((a, b) => `${a.route} ${a.method}`.localeCompare(`${b.route} ${b.method}`));
}

function baseRouteFromFile(routesRoot: string, filePath: string): string {
    const relative = path.relative(routesRoot, filePath).replace(/\\/g, "/").replace(/\.ts$/, "");
    const parts = relative.split("/").filter((part) => part !== "index");
    return `/${parts.map(routePartFromFilePart).join("/")}`;
}

function routePartFromFilePart(part: string): string {
    if (part.startsWith("#")) {
        return `{${part.slice(1)}}`;
    }

    return part;
}

function joinRoute(baseRoute: string, suffix: string): string {
    const normalizedSuffix = suffix.replace(/^\/+|\/+$/g, "");
    if (!normalizedSuffix) {
        return baseRoute;
    }

    return `${baseRoute.replace(/\/+$/g, "")}/${normalizedSuffix.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}")}`;
}

async function routeFiles(directory: string): Promise<string[]> {
    const output: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            output.push(...(await routeFiles(entryPath)));
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
            output.push(entryPath);
        }
    }

    return output;
}

function routeName(method: HttpMethod, route: string): string {
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

function extractResponseRefs(segment: string): string[] {
    return Array.from(segment.matchAll(/body\s*:\s*"([^"]+)"/g))
        .map((match) => match[1])
        .filter((value, index, all) => all.indexOf(value) === index)
        .sort();
}

function extractString(text: string, pattern: RegExp): string | undefined {
    return pattern.exec(text)?.[1];
}

function dedupe(entries: RouteCatalogEntry[]): RouteCatalogEntry[] {
    const seen = new Set<string>();
    const output: RouteCatalogEntry[] = [];
    for (const entry of entries) {
        const key = `${entry.method} ${entry.route}`;
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        output.push(entry);
    }

    return output;
}
