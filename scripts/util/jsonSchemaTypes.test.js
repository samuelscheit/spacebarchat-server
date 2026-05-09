const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const Ajv = require("ajv");

const { findInvalidJsonSchemaTypes, normalizeGeneratedJsonSchemaTypes } = require("./jsonSchemaTypes");

const validJsonSchemaTypes = ["array", "boolean", "integer", "null", "number", "object", "string"];

function readGeneratedSchemas() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "assets", "schemas.json"), "utf8"));
}

function schemaTypes(schemas, schema) {
    if (schema.$ref) {
        const match = /^#\/definitions\/(.+)$/.exec(schema.$ref);
        assert.ok(match, `unexpected schema ref ${schema.$ref}`);
        return schemaTypes(schemas, schemas[match[1]]);
    }

    return (Array.isArray(schema.type) ? schema.type : [schema.type]).sort();
}

test("normalizes TypeScript bigint output to JSON Schema integer", () => {
    const schema = {
        type: "object",
        properties: {
            direct: { type: "bigint" },
            union: { type: ["null", "bigint"] },
            fallback: { type: "number", properties: {}, additionalProperties: false },
        },
    };

    normalizeGeneratedJsonSchemaTypes(schema);

    assert.deepEqual(schema.properties.direct, { type: "integer" });
    assert.deepEqual(schema.properties.union, { type: ["null", "integer"] });
    assert.deepEqual(schema.properties.fallback, { type: "integer" });
});

test("generated schemas contain only JSON Schema primitive types", () => {
    const schemas = readGeneratedSchemas();
    const invalidTypes = findInvalidJsonSchemaTypes(schemas);

    assert.deepEqual(invalidTypes, []);
});

test("generated schemas can be registered with strict AJV", () => {
    const schemas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "assets", "schemas.json"), "utf8").replaceAll("#/definitions/", ""));

    assert.doesNotThrow(() => {
        new Ajv({
            schemas,
            strict: true,
            strictRequired: true,
            allowUnionTypes: true,
        });
    });
});

test("IdentifySchema bitfield wire fields are emitted as JSON-safe schema types", () => {
    const schemas = readGeneratedSchemas();
    const identifyProperties = schemas.IdentifySchema.properties;
    const intentTypes = schemaTypes(schemas, identifyProperties.intents);
    const shardItemTypes = schemaTypes(schemas, identifyProperties.shard.items);

    assert.deepEqual(intentTypes, ["integer", "string"]);
    assert.equal(identifyProperties.shard.type, "array");
    assert.deepEqual(shardItemTypes, ["integer", "string"]);

    for (const type of [...intentTypes, ...shardItemTypes]) {
        assert.ok(validJsonSchemaTypes.includes(type), type);
    }
});
