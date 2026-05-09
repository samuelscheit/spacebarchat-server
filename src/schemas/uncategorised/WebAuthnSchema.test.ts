import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { ajv } from "../Validator";

const RegistrationSchemaNames = ["StartWebAuthnCredentialRegistrationSchema", "FinishWebAuthnCredentialRegistrationSchema"];
const ObsoleteRegistrationSchemaNames = ["GenerateWebAuthnCredentialsSchema", "CreateWebAuthnCredentialSchema"];

type SchemaWithUnion = {
    anyOf?: Array<{ $ref?: string }>;
};

type SchemaMap = Record<string, SchemaWithUnion | undefined>;

type OpenApiDocument = {
    components?: {
        schemas?: SchemaMap;
    };
};

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}

function schemaRefNamesFrom(schema: SchemaWithUnion, prefix: string) {
    return schema.anyOf?.map((item) => item.$ref?.replace(prefix, "")) ?? [];
}

function registeredSchemaRefNames(schemaName: string) {
    const schema = ajv.getSchema(schemaName)?.schema as SchemaWithUnion | undefined;
    assert.ok(schema, `${schemaName} must be registered`);

    return schemaRefNamesFrom(schema, "#/definitions/");
}

describe("WebAuthn credential registration schemas", () => {
    test("names both registration payloads by their protocol phases", () => {
        for (const schemaName of RegistrationSchemaNames) {
            assert.ok(ajv.getSchema(schemaName), `${schemaName} must be registered`);
        }

        for (const schemaName of ObsoleteRegistrationSchemaNames) {
            assert.equal(ajv.getSchema(schemaName), undefined, `${schemaName} must not be registered`);
        }

        assert.deepEqual(registeredSchemaRefNames("WebAuthnPostSchema"), RegistrationSchemaNames);
    });

    test("publishes the phase-specific registration names in generated schema assets", () => {
        const schemas = readJson<SchemaMap>("assets/schemas.json");

        for (const schemaName of RegistrationSchemaNames) {
            assert.ok(schemas[schemaName], `${schemaName} must be present in schemas.json`);
        }

        for (const schemaName of ObsoleteRegistrationSchemaNames) {
            assert.equal(schemas[schemaName], undefined, `${schemaName} must not be present in schemas.json`);
        }

        assert.ok(schemas.WebAuthnPostSchema);
        assert.deepEqual(schemaRefNamesFrom(schemas.WebAuthnPostSchema, "#/definitions/"), RegistrationSchemaNames);
    });

    test("publishes the phase-specific registration names in OpenAPI", () => {
        const schemas = readJson<OpenApiDocument>("assets/openapi.json").components?.schemas ?? {};

        for (const schemaName of RegistrationSchemaNames) {
            assert.ok(schemas[schemaName], `${schemaName} must be present in OpenAPI`);
        }

        for (const schemaName of ObsoleteRegistrationSchemaNames) {
            assert.equal(schemas[schemaName], undefined, `${schemaName} must not be present in OpenAPI`);
        }

        assert.ok(schemas.WebAuthnPostSchema);
        assert.deepEqual(schemaRefNamesFrom(schemas.WebAuthnPostSchema, "#/components/schemas/"), RegistrationSchemaNames);
    });

    test("validates both WebAuthn credential registration phases", () => {
        assert.equal(ajv.validate("WebAuthnPostSchema", { password: "correct horse battery staple" }), true);
        assert.equal(
            ajv.validate("WebAuthnPostSchema", {
                credential: JSON.stringify({ id: "credential-id", rawId: "credential-id", response: {}, type: "public-key" }),
                name: "Laptop security key",
                ticket: "registration-ticket",
            }),
            true,
        );
    });

    test("rejects incomplete registration completion payloads", () => {
        assert.equal(
            ajv.validate("FinishWebAuthnCredentialRegistrationSchema", {
                credential: JSON.stringify({ id: "credential-id" }),
                ticket: "registration-ticket",
            }),
            false,
        );
    });
});
