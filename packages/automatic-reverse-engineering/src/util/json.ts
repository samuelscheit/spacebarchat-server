export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stableStringify(value: unknown): string {
    return JSON.stringify(sortForStableJson(value));
}

export function sortForStableJson(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => sortForStableJson(item));
    }

    if (!isRecord(value)) {
        return value;
    }

    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
        const child = value[key];
        if (typeof child !== "undefined") {
            output[key] = sortForStableJson(child);
        }
    }

    return output;
}

export function tryParseJson(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return undefined;
    }
}

export function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
