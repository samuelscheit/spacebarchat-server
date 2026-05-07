import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

type JsonValue = JsonValue[] | { [key: string]: JsonValue } | boolean | number | string | null;
type SchemaMap = Record<string, JsonValue>;

function readJsonAsset<T extends JsonValue>(filename: string): T {
    return JSON.parse(readFileSync(join(process.cwd(), "assets", filename), "utf8")) as T;
}

function assertSchemaRefsResolve(rootSchemas: SchemaMap, schemaName: string, refPrefix: string) {
    const schema = rootSchemas[schemaName];
    assert.ok(schema, `Expected ${schemaName} to be generated`);

    const visitedRefs = new Set<string>();

    function resolveRef(ref: string) {
        assert.ok(ref.startsWith(refPrefix), `Expected ${schemaName} to use a local schema ref, got ${ref}`);

        const targetName = decodeURIComponent(ref.slice(refPrefix.length));
        const target = rootSchemas[targetName];
        assert.ok(target, `Missing local schema ref ${ref} referenced by ${schemaName}`);

        return target;
    }

    function visit(value: JsonValue) {
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }

        if (!value || typeof value !== "object") return;

        const ref = value.$ref;
        if (typeof ref === "string" && ref.startsWith(refPrefix) && !visitedRefs.has(ref)) {
            visitedRefs.add(ref);
            visit(resolveRef(ref));
        }

        for (const [key, child] of Object.entries(value)) {
            if (key === "$ref") continue;
            visit(child);
        }
    }

    visit(schema);
}

describe("generated API error response schemas", () => {
    test("JSON schemas include every local schema referenced by APIErrorResponse", () => {
        const schemas = readJsonAsset<SchemaMap>("schemas.json");

        assertSchemaRefsResolve(schemas, "APIErrorResponse", "#/definitions/");
    });

    test("OpenAPI schemas include every local component referenced by APIErrorResponse", () => {
        const openapi = readJsonAsset<{ components: { schemas: SchemaMap } }>("openapi.json");

        assertSchemaRefsResolve(openapi.components.schemas, "APIErrorResponse", "#/components/schemas/");
    });
});
