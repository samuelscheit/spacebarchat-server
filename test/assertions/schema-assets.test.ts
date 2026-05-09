import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    pattern?: string;
    properties?: Record<string, JsonSchema>;
    type?: string | string[];
};

const schemaJson = readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8");
const Schemas = JSON.parse(schemaJson) as Record<string, JsonSchema>;
const AjvSchemas = JSON.parse(schemaJson.replaceAll("#/definitions/", "")) as Record<string, AnySchema>;
const JsonSchemaTypes = new Set(["array", "boolean", "integer", "null", "number", "object", "string"]);

function visitSchema(value: unknown, path: string, visitor: (schema: Record<string, unknown>, path: string) => void) {
    if (!value || typeof value !== "object") return;

    visitor(value as Record<string, unknown>, path);

    for (const [key, child] of Object.entries(value)) {
        visitSchema(child, `${path}.${key}`, visitor);
    }
}

function resolveSchema(schema: JsonSchema | undefined): JsonSchema {
    assert.ok(schema);

    if (!schema.$ref) return schema;

    const match = /^#\/definitions\/(.+)$/.exec(schema.$ref);
    assert.ok(match, `unexpected schema ref ${schema.$ref}`);
    return resolveSchema(Schemas[match[1]]);
}

function schemaTypes(schema: JsonSchema | undefined): string[] {
    const resolved = resolveSchema(schema);
    return (Array.isArray(resolved.type) ? resolved.type : [resolved.type]).filter((type): type is string => typeof type === "string").sort();
}

test("schema asset only emits JSON Schema primitive types", () => {
    for (const [schemaName, schema] of Object.entries(Schemas)) {
        visitSchema(schema, schemaName, (node, path) => {
            if (!("type" in node)) return;

            const rawType = node.type;
            if (typeof rawType !== "string" && !Array.isArray(rawType)) return;

            const types = Array.isArray(rawType) ? rawType : [rawType];

            for (const type of types) {
                assert.equal(typeof type, "string", `${path}.type must be a string JSON Schema type`);
                assert.equal(JsonSchemaTypes.has(type), true, `${path}.type uses ${type}, which is not a JSON Schema primitive type`);
            }
        });
    }
});

test("schema asset keeps gateway identify bitfields JSON-safe", () => {
    const identify = resolveSchema(Schemas.IdentifySchema);
    const intents = resolveSchema(identify.properties?.intents);
    const shardItems = resolveSchema(identify.properties?.shard?.items);

    assert.deepEqual(schemaTypes(identify.properties?.intents), ["integer", "string"]);
    assert.deepEqual(schemaTypes(identify.properties?.shard?.items), ["integer", "string"]);
    assert.equal(intents.pattern, "^-?[0-9]+$");
    assert.equal(shardItems.pattern, "^-?[0-9]+$");
});

test("schema asset compiles IdentifySchema and validates gateway identify bitfields", () => {
    const ajv = new Ajv({
        allErrors: true,
        parseDate: true,
        allowDate: true,
        schemas: AjvSchemas,
        coerceTypes: true,
        messages: true,
        strict: true,
        strictRequired: true,
        allowUnionTypes: true,
    });
    addFormats(ajv);

    const validate = ajv.getSchema("IdentifySchema");
    assert.ok(validate);

    assert.equal(
        validate({
            token: "gateway-token",
            properties: {
                os: "linux",
                browser: "spacebar",
                device: "desktop",
            },
            intents: 513,
            shard: [0, 1],
        }),
        true,
        JSON.stringify(validate.errors, null, 2),
    );

    assert.equal(
        validate({
            token: "gateway-token",
            properties: {},
            intents: "9007199254740993",
            shard: ["0", "1"],
        }),
        true,
        JSON.stringify(validate.errors, null, 2),
    );

    assert.equal(
        validate({
            token: "gateway-token",
            properties: {},
            intents: "1.5",
            shard: ["0", "1"],
        }),
        false,
    );
});
