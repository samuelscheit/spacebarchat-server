const assert = require("node:assert/strict");
const { test } = require("node:test");

const { normalizeNullableTypes } = require("./openapiSchema");

test("OpenAPI 3.1 preserves JSON Schema nullable unions", () => {
    const schema = {
        type: "object",
        properties: {
            country_code: { type: ["null", "string"] },
            nested: { type: "array", items: { type: ["integer", "null"] } },
        },
    };

    assert.equal(normalizeNullableTypes(schema, "3.1.0"), schema);
    assert.deepEqual(schema.properties.country_code, { type: ["null", "string"] });
    assert.deepEqual(schema.properties.nested.items, { type: ["integer", "null"] });
});

test("OpenAPI 3.0 converts JSON Schema nullable unions to nullable fields", () => {
    const schema = {
        type: "object",
        properties: {
            country_code: { type: ["null", "string"] },
            nested: { type: "array", items: { type: ["integer", "null"] } },
        },
    };

    normalizeNullableTypes(schema, "3.0.3");

    assert.deepEqual(schema.properties.country_code, { type: "string", nullable: true });
    assert.deepEqual(schema.properties.nested.items, { type: "integer", nullable: true });
});
