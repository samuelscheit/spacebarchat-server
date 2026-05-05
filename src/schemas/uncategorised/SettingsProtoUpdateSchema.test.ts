import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, test } from "node:test";
import Ajv from "ajv";
import addFormats from "ajv-formats";

describe("SettingsProtoUpdateJsonSchema", () => {
    test("generates a JSON value schema without array prototype properties", () => {
        const schemas = JSON.parse(fs.readFileSync("assets/schemas.json", "utf8"));
        const jsonValue = JSON.stringify(schemas.JsonValue);

        assert.equal(schemas.SettingsProtoUpdateJsonSchema.properties.settings.$ref, "#/definitions/JsonValue");
        assert.ok(!jsonValue.includes("__@unscopables"));
        assert.ok(!jsonValue.includes("toString"));
        assert.ok(!jsonValue.includes("push"));
    });

    test("validates arbitrary JSON settings objects", () => {
        const schemas = JSON.parse(fs.readFileSync("assets/schemas.json", "utf8").replaceAll("#/definitions/", ""));
        const ajv = new Ajv({
            allErrors: true,
            schemas,
            coerceTypes: true,
            messages: true,
            strict: true,
            strictRequired: true,
            allowUnionTypes: true,
        });
        addFormats(ajv);

        const validate = ajv.getSchema("SettingsProtoUpdateJsonSchema");
        assert.ok(validate);

        assert.equal(validate({ settings: [] }), true);
        assert.equal(
            validate({
                settings: {
                    versions: { dataVersion: 1 },
                    sections: ["privacy", "notifications", null],
                    flags: { compactMode: true, guildPositions: [1, 2, 3] },
                },
                required_data_version: 1,
            }),
            true,
        );

        assert.equal(validate({ required_data_version: 1 }), false);
        assert.equal(validate({ settings: {}, unexpected: true }), false);
        assert.equal(validate({ settings: {}, required_data_version: {} }), false);
    });

    test("is no longer skipped by route validation", () => {
        const routeHandler = fs.readFileSync("src/api/util/handlers/route.ts", "utf8");

        assert.ok(!routeHandler.includes("ignoredRequestSchemas"));
        assert.ok(!routeHandler.includes('"SettingsProtoUpdateJsonSchema"'));
    });
});
