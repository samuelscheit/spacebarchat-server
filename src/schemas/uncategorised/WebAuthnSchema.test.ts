import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ajv } from "../Validator";

function schemaRefNames(schemaName: string) {
    const schema = ajv.getSchema(schemaName)?.schema as { anyOf?: Array<{ $ref?: string }> } | undefined;
    assert.ok(schema, `${schemaName} must be registered`);

    return schema.anyOf?.map((item) => item.$ref?.replace("#/definitions/", "")) ?? [];
}

describe("WebAuthn credential registration schemas", () => {
    test("names the registration completion payload by its protocol phase", () => {
        assert.ok(ajv.getSchema("GenerateWebAuthnCredentialsSchema"));
        assert.ok(ajv.getSchema("FinishWebAuthnCredentialRegistrationSchema"));
        assert.equal(ajv.getSchema("CreateWebAuthnCredentialSchema"), undefined);
        assert.deepEqual(schemaRefNames("WebAuthnPostSchema"), ["GenerateWebAuthnCredentialsSchema", "FinishWebAuthnCredentialRegistrationSchema"]);
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
