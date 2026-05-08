import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

interface JsonShape {
    $ref?: string;
    additionalProperties?: JsonShape | boolean;
    properties?: Record<string, JsonShape>;
    type?: string | string[];
}

test("application command index permissions use a generated map schema", () => {
    const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonShape>;
    const permissions = schemas.ApplicationCommandIndexPermissions;

    assert.equal(permissions.properties?.roles?.$ref, "#/definitions/ApplicationCommandIndexPermissionMap");
    assert.equal(permissions.properties?.channels?.$ref, "#/definitions/ApplicationCommandIndexPermissionMap");
    assert.deepEqual(schemas.ApplicationCommandIndexPermissionMap, {
        type: "object",
        additionalProperties: {
            type: "boolean",
        },
        $schema: "http://json-schema.org/draft-07/schema#",
    });
});
