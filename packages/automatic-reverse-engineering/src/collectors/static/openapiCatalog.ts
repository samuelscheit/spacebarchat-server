import { normalizeRoutePattern } from "../../processors/normalize.js";
import { HttpMethod, RouteCatalogEntry } from "../../types.js";
import { isRecord } from "../../util/json.js";

const httpMethods = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);

export interface OpenApiImportOptions {
    source?: string;
}

export function importOpenApiRouteCatalog(openApi: unknown, options: OpenApiImportOptions = {}): RouteCatalogEntry[] {
    if (!isRecord(openApi) || !isRecord(openApi.paths)) {
        throw new Error("OpenAPI document must contain a paths object");
    }

    const source = options.source ?? "openapi";
    const entries: RouteCatalogEntry[] = [];

    for (const [path, pathItem] of Object.entries(openApi.paths)) {
        if (!isRecord(pathItem)) {
            continue;
        }

        for (const [method, operation] of Object.entries(pathItem)) {
            if (!httpMethods.has(method) || !isRecord(operation)) {
                continue;
            }

            const upperMethod = method.toUpperCase() as HttpMethod;
            const route = normalizeRoutePattern(path);
            entries.push({
                method: upperMethod,
                route,
                route_name: routeNameForOperation(upperMethod, route, operation),
                source,
                summary: stringField(operation.summary),
                description: stringField(operation.description),
                request_schema_ref: requestSchemaRef(operation),
                response_schema_refs: responseSchemaRefs(operation),
            });
        }
    }

    return entries.sort((a, b) => `${a.route} ${a.method}`.localeCompare(`${b.route} ${b.method}`));
}

function routeNameForOperation(method: HttpMethod, route: string, operation: Record<string, unknown>): string {
    const operationId = stringField(operation.operationId);
    if (operationId) {
        return operationId;
    }

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

function requestSchemaRef(operation: Record<string, unknown>): string | undefined {
    const body = operation.requestBody;
    if (!isRecord(body) || !isRecord(body.content)) {
        return undefined;
    }

    for (const media of Object.values(body.content)) {
        if (!isRecord(media) || !isRecord(media.schema)) {
            continue;
        }

        const ref = stringField(media.schema.$ref);
        if (ref) {
            return ref;
        }
    }

    return undefined;
}

function responseSchemaRefs(operation: Record<string, unknown>): string[] {
    const responses = operation.responses;
    if (!isRecord(responses)) {
        return [];
    }

    const refs = new Set<string>();
    for (const response of Object.values(responses)) {
        if (!isRecord(response) || !isRecord(response.content)) {
            continue;
        }

        for (const media of Object.values(response.content)) {
            if (!isRecord(media) || !isRecord(media.schema)) {
                continue;
            }

            collectRefs(media.schema, refs);
        }
    }

    return Array.from(refs).sort();
}

function collectRefs(schema: Record<string, unknown>, refs: Set<string>): void {
    const ref = stringField(schema.$ref);
    if (ref) {
        refs.add(ref);
    }

    for (const value of Object.values(schema)) {
        if (Array.isArray(value)) {
            for (const item of value) {
                if (isRecord(item)) {
                    collectRefs(item, refs);
                }
            }
        } else if (isRecord(value)) {
            collectRefs(value, refs);
        }
    }
}

function stringField(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
