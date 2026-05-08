import { hashJson } from "../util/hash.js";
import { isRecord } from "../util/json.js";

export type Shape =
    | "null"
    | "boolean"
    | "number"
    | "string"
    | { type: "array"; items: Shape | "unknown"; variants?: Shape[] }
    | { type: "object"; keys: Record<string, Shape>; optional_keys?: string[] };

export interface ShapeResult {
    shape: Shape;
    hash: string;
}

export function createShape(value: unknown): Shape {
    if (value === null) {
        return "null";
    }

    if (Array.isArray(value)) {
        const variants = uniqueShapes(value.map((item) => createShape(item)));
        if (variants.length === 0) {
            return { type: "array", items: "unknown" };
        }

        if (variants.length === 1) {
            return { type: "array", items: variants[0] };
        }

        return {
            type: "array",
            items: "unknown",
            variants,
        };
    }

    switch (typeof value) {
        case "boolean":
            return "boolean";
        case "number":
            return "number";
        case "string":
            return "string";
        case "object": {
            if (!isRecord(value)) {
                return "string";
            }

            const keys: Record<string, Shape> = {};
            for (const [key, child] of Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) {
                keys[key] = createShape(child);
            }

            return { type: "object", keys };
        }
        default:
            return "string";
    }
}

export function shapeResult(value: unknown): ShapeResult {
    const shape = createShape(value);
    return {
        shape,
        hash: hashJson(shape),
    };
}

function uniqueShapes(shapes: Shape[]): Shape[] {
    const seen = new Set<string>();
    const output: Shape[] = [];
    for (const shape of shapes) {
        const key = JSON.stringify(shape);
        if (!seen.has(key)) {
            seen.add(key);
            output.push(shape);
        }
    }

    return output;
}
