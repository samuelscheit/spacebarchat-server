import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ajv } from "../Validator";

type JsonSchema = {
    $ref?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    type?: string | string[];
};

const Schemas = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "..", "assets", "schemas.json"), { encoding: "utf8" })) as Record<string, JsonSchema>;

function schemaTypes(schema: JsonSchema | undefined): string[] {
    assert.ok(schema);

    if (schema.$ref) {
        const match = /^#\/definitions\/(.+)$/.exec(schema.$ref);
        assert.ok(match, `unexpected schema ref ${schema.$ref}`);
        return schemaTypes(Schemas[match[1]]);
    }

    return (Array.isArray(schema.type) ? schema.type : [schema.type]).filter((type): type is string => typeof type === "string").sort();
}

test("IdentifySchema emits valid JSON Schema for gateway bitfields", () => {
    const schema = Schemas.IdentifySchema;
    assert.ok(schema);
    assert.deepEqual(schemaTypes(schema.properties?.intents), ["integer", "string"]);
    assert.equal(schema.properties?.shard?.type, "array");
    assert.deepEqual(schemaTypes(schema.properties?.shard?.items), ["integer", "string"]);
});

test("IdentifySchema validator accepts JSON-safe integer and string bitfields", () => {
    const validate = ajv.getSchema("IdentifySchema");
    assert.ok(validate);

    assert.equal(
        validate({
            token: "token",
            properties: {},
            intents: 513,
            shard: [0, 2],
        }),
        true,
        JSON.stringify(validate.errors),
    );

    assert.equal(
        validate({
            token: "token",
            properties: {},
            intents: "1099511627776",
            shard: ["1", "16"],
        }),
        true,
        JSON.stringify(validate.errors),
    );
});
