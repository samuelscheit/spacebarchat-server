import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import Ajv, { type AnySchema } from "ajv";
import addFormats from "ajv-formats";

const userEntityRelationFields = ["sessions", "relationships"] as const;
const generatedUserSchemas = ["PublicUser", "APIPublicUser", "APIPrivateUser", "PartialUser"] as const;

interface JsonSchemaShape {
    properties?: Record<string, unknown>;
    required?: string[];
}

function readGeneratedSchemas() {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, JsonSchemaShape>;
}

function createAjv() {
    const schemas = JSON.parse(JSON.stringify(readGeneratedSchemas()).replaceAll("#/definitions/", "")) as Record<string, AnySchema>;
    const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, schemas, strict: true });
    addFormats(ajv);
    return ajv;
}

test("API user schema source stays decoupled from TypeORM user relations", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "schemas", "api", "users", "User.ts"), "utf8");
    assert.doesNotMatch(source, /from\s+["']@spacebar\/util(?:\/entities(?:\/[\w-]+)?)?["']/u);

    for (const field of userEntityRelationFields) {
        assert.doesNotMatch(source, new RegExp(`^\\s+${field}\\??\\s*:`, "mu"), `${field} must stay out of the schema-only user source type`);
    }
});

test("generated user API schemas do not expose internal user relation collections", () => {
    const schemas = readGeneratedSchemas();

    for (const schemaName of generatedUserSchemas) {
        const schema = schemas[schemaName];
        assert.ok(schema, `${schemaName} should be generated`);

        for (const field of userEntityRelationFields) {
            assert.equal(schema.properties?.[field], undefined, `${schemaName} must not expose ${field}`);
            assert.equal(schema.required?.includes(field), false, `${schemaName} must not require ${field}`);
        }
    }
});

test("public user API schema rejects entity relation collections as extra properties", () => {
    const validate = createAjv().getSchema("APIPublicUser");
    assert.ok(validate, "APIPublicUser validator should be registered");

    const publicUser = {
        id: "100000000000000001",
        username: "schema-user",
        discriminator: "0001",
        public_flags: 0,
        bio: "",
        bot: false,
        premium_type: 0,
    };

    assert.equal(validate(publicUser), true, `minimal APIPublicUser should validate: ${JSON.stringify(validate.errors)}`);

    for (const field of userEntityRelationFields) {
        assert.equal(validate({ ...publicUser, [field]: [] }), false, `APIPublicUser must reject ${field} as an entity-only extra property`);
        assert.equal(
            validate.errors?.some((error) => error.keyword === "additionalProperties"),
            true,
            `${field} should fail additionalProperties validation`,
        );
    }
});
