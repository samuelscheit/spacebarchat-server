import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import Ajv from "ajv";

const schemaPath = path.join(process.cwd(), "assets", "schemas.json");
const rawSchemas = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajvSchemas = JSON.parse(readFileSync(schemaPath, "utf8").replaceAll("#/definitions/", ""));

test("location metadata country code is required and nullable", () => {
    const schema = rawSchemas.LocationMetadataResponse;

    assert.deepEqual(schema.properties.country_code.type, ["null", "string"]);
    assert.ok(schema.required.includes("country_code"));
});

test("location metadata validates unavailable country lookup", () => {
    const ajv = new Ajv({
        allErrors: true,
        schemas: ajvSchemas,
        strict: true,
        strictRequired: true,
        allowUnionTypes: true,
    });

    const validate = ajv.getSchema("LocationMetadataResponse");
    assert.ok(validate);

    assert.equal(
        validate({
            consent_required: false,
            country_code: null,
            promotional_email_opt_in: { required: true, pre_checked: false },
        }),
        true,
    );

    assert.equal(
        validate({
            consent_required: false,
            promotional_email_opt_in: { required: true, pre_checked: false },
        }),
        false,
    );
});
