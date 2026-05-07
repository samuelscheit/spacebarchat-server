import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import Ajv from "ajv";

function getAssetPath(filename: string): string {
    return path.join(__dirname, "..", "..", "..", "assets", filename);
}

const schemaPath = getAssetPath("schemas.json");
const openapiPath = getAssetPath("openapi.json");
const rawSchemas = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajvSchemas = JSON.parse(readFileSync(schemaPath, "utf8").replaceAll("#/definitions/", ""));
const openapi = JSON.parse(readFileSync(openapiPath, "utf8"));

test("location metadata country code is required and nullable", () => {
    const schema = rawSchemas.LocationMetadataResponse;

    assert.deepEqual(schema.properties.country_code.type, ["null", "string"]);
    assert.ok(schema.required.includes("country_code"));
});

test("location metadata OpenAPI country code uses a required JSON Schema nullable union", () => {
    const schema = openapi.components.schemas.LocationMetadataResponse;

    assert.equal(openapi.openapi, "3.1.0");
    assert.deepEqual(schema.properties.country_code.type, ["null", "string"]);
    assert.equal(Object.hasOwn(schema.properties.country_code, "nullable"), false);
    assert.ok(schema.required.includes("country_code"));
});

test("location metadata schema test asset path is cwd-independent", () => {
    const originalCwd = process.cwd();
    const otherCwd = mkdtempSync(path.join(tmpdir(), "spacebar-location-metadata-"));

    try {
        process.chdir(otherCwd);
        assert.equal(getAssetPath("schemas.json"), schemaPath);
        assert.notEqual(schemaPath, path.join(process.cwd(), "assets", "schemas.json"));
        assert.ok(JSON.parse(readFileSync(getAssetPath("schemas.json"), "utf8")).LocationMetadataResponse);
    } finally {
        process.chdir(originalCwd);
        rmSync(otherCwd, { recursive: true, force: true });
    }
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
