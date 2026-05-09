export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export interface RouteCatalogEntry {
    method: HttpMethod | string;
    route: string;
    route_name: string;
    source: string;
    summary?: string;
    description?: string;
    request_schema_ref?: string;
    response_schema_refs?: string[];
}

export interface RouteCatalogSource {
    path: string;
    entries: RouteCatalogEntry[];
}

export interface CompareOptions {
    ignoredAdditional?: Iterable<string>;
    ignoredMethods?: Iterable<string>;
}

export interface MissingRouteReport {
    missing: number;
    spacebar: number;
    discord: number;
    routes: string[];
    additional: string[];
    missing_entries: ComparedRouteEntry[];
    additional_entries: ComparedRouteEntry[];
    catalogs: {
        implemented: string;
        targets: string[];
    };
    ignored_methods: string[];
    method_aware: true;
}

export interface ComparedRouteEntry {
    method: HttpMethod;
    route: string;
    route_name?: string;
    sources: string[];
    source_routes?: string[];
    summaries?: string[];
}

const httpMethods = new Set<HttpMethod>(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);

export function buildMissingRouteReport(implemented: RouteCatalogSource, targets: RouteCatalogSource[], options: CompareOptions = {}): MissingRouteReport {
    const ignoredMethods = new Set(Array.from(options.ignoredMethods ?? []).map((method) => method.toUpperCase()));
    const ignoredAdditional = new Set(options.ignoredAdditional ?? []);
    const implementedRoutes = catalogMap([implemented], ignoredMethods);
    const targetRoutes = catalogMap(targets, ignoredMethods);

    const missingEntries = Array.from(targetRoutes.entries())
        .filter(([key]) => !implementedRoutes.has(key))
        .map(([, entry]) => entry)
        .sort(compareEntries);

    const additionalEntries = Array.from(implementedRoutes.entries())
        .filter(([key]) => !targetRoutes.has(key) && !ignoredAdditional.has(key))
        .map(([, entry]) => entry)
        .sort(compareEntries);

    return {
        missing: missingEntries.length,
        spacebar: implementedRoutes.size,
        discord: targetRoutes.size,
        routes: uniqueRoutes(missingEntries),
        additional: uniqueRoutes(additionalEntries),
        missing_entries: missingEntries,
        additional_entries: additionalEntries,
        catalogs: {
            implemented: implemented.path,
            targets: targets.map((target) => target.path),
        },
        ignored_methods: Array.from(ignoredMethods).sort(),
        method_aware: true,
    };
}

function catalogMap(sources: RouteCatalogSource[], ignoredMethods: Set<string>): Map<string, ComparedRouteEntry> {
    const output = new Map<string, ComparedRouteEntry>();
    for (const source of sources) {
        for (const entry of source.entries) {
            const route = normalizeCatalogEntry(entry);
            if (!route || ignoredMethods.has(route.method)) {
                continue;
            }

            const key = routeKey(route);
            const existing = output.get(key);
            if (existing) {
                addUnique(existing.sources, route.sources[0]);
                existing.source_routes = mergeUnique(existing.source_routes, route.source_routes);
                const summary = route.summaries?.[0];
                if (summary) {
                    existing.summaries ??= [];
                    addUnique(existing.summaries, summary);
                }
                existing.route_name ??= route.route_name;
                continue;
            }

            output.set(key, route);
        }
    }
    return output;
}

function normalizeCatalogEntry(entry: RouteCatalogEntry): ComparedRouteEntry | undefined {
    const method = entry.method.toUpperCase();
    if (!httpMethods.has(method as HttpMethod) || !entry.route.startsWith("/")) {
        return undefined;
    }

    const sourceRoute = normalizeRoute(entry.route);
    const canonicalRoute = canonicalRoutePattern(sourceRoute);
    const summary = entry.summary ?? entry.description;
    return {
        method: method as HttpMethod,
        route: canonicalRoute,
        route_name: entry.route_name,
        sources: [entry.source],
        source_routes: sourceRoute === canonicalRoute ? undefined : [sourceRoute],
        summaries: summary ? [summary] : undefined,
    };
}

function normalizeRoute(route: string): string {
    if (route === "/") {
        return route;
    }
    return route.replace(/\/+$/g, "");
}

function canonicalRoutePattern(route: string): string {
    return route.replace(/\{[^}/]+\}/g, "{param}").replace(/:[A-Za-z_][A-Za-z0-9_]*/g, "{param}");
}

function routeKey(entry: Pick<ComparedRouteEntry, "method" | "route">): string {
    return `${entry.method} ${entry.route}`;
}

function uniqueRoutes(entries: ComparedRouteEntry[]): string[] {
    return Array.from(new Set(entries.map((entry) => entry.route))).sort();
}

function addUnique(values: string[], value: string): void {
    if (!values.includes(value)) {
        values.push(value);
    }
}

function mergeUnique(values: string[] | undefined, additions: string[] | undefined): string[] | undefined {
    if (!additions) {
        return values;
    }
    const output = values ?? [];
    for (const value of additions) {
        addUnique(output, value);
    }
    return output;
}

function compareEntries(a: ComparedRouteEntry, b: ComparedRouteEntry): number {
    return routeKey(a).localeCompare(routeKey(b));
}
