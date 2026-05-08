import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";

const Schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8").replaceAll("#/definitions/", "")) as Record<string, AnySchema>;

function visitSchema(value: unknown, path: string, visitor: (schema: Record<string, unknown>, path: string) => void) {
    if (!value || typeof value !== "object") return;

    visitor(value as Record<string, unknown>, path);

    for (const [key, child] of Object.entries(value)) {
        visitSchema(child, `${path}.${key}`, visitor);
    }
}

test("schema asset does not emit TypeScript-only bigint types", () => {
    for (const [schemaName, schema] of Object.entries(Schemas)) {
        visitSchema(schema, schemaName, (node, path) => {
            if (!("type" in node)) return;

            const rawType = node.type;
            const types = Array.isArray(rawType) ? rawType : [rawType];

            for (const type of types) {
                assert.notEqual(type, "bigint", `${path}.type uses TypeScript-only bigint instead of a JSON Schema number type`);
            }
        });
    }
});

test("schema asset normalizes gateway identify bigint fields to JSON integer schemas", () => {
    const identify = Schemas.IdentifySchema as { properties: { intents: { type: string }; shard: { items: { type: string } } } };

    assert.equal(identify.properties.intents.type, "integer");
    assert.equal(identify.properties.shard.items.type, "integer");
});

test("schema asset compiles IdentifySchema and accepts numeric gateway identify bitfields", () => {
    const ajv = new Ajv({
        allErrors: true,
        parseDate: true,
        allowDate: true,
        schemas: Schemas,
        coerceTypes: true,
        messages: true,
        strict: true,
        strictRequired: true,
        allowUnionTypes: true,
    });
    addFormats(ajv);

    const validate = ajv.getSchema("IdentifySchema");
    assert.ok(validate);

    const valid = validate({
        token: "gateway-token",
        properties: {
            os: "linux",
            browser: "spacebar",
            device: "desktop",
        },
        intents: 513,
        shard: [0, 1],
    });

    assert.equal(valid, true, JSON.stringify(validate.errors, null, 2));
});
