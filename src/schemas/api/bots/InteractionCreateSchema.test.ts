import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, unknown>;
const interactionCreateSchema = {
    ...(schemas.InteractionCreateSchema as Record<string, unknown>),
    definitions: schemas,
};

function compileInteractionCreateSchema() {
    return new Ajv({ strict: false, validateFormats: false }).compile(interactionCreateSchema);
}

function validInteractionPayload() {
    return {
        version: 1,
        id: "100000000000000001",
        application_id: "100000000000000002",
        type: 2,
        token: "interaction-token",
        app_permissions: "0",
        attachment_size_limit: 26214400,
        context: 0,
        authorizing_integration_owners: {
            "0": "100000000000000003",
        },
        data: {
            id: "100000000000000004",
            name: "ping",
            version: "100000000000000005",
        },
        entitlements: [
            {
                id: "100000000000000006",
                sku_id: "100000000000000007",
                application_id: "100000000000000002",
                user_id: "100000000000000003",
                type: 8,
                deleted: false,
                starts_at: null,
                ends_at: "2026-01-01T00:00:00.000Z",
                consumed: false,
            },
        ],
    };
}

describe("InteractionCreateSchema", () => {
    test("accepts a typed Discord-compatible interaction create payload", () => {
        const validate = compileInteractionCreateSchema();

        assert.equal(validate(validInteractionPayload()), true, JSON.stringify(validate.errors));
    });

    test("rejects interaction create payloads outside the typed contract", () => {
        const validate = compileInteractionCreateSchema();

        assert.equal(validate({ ...validInteractionPayload(), version: 2 }), false);
        assert.equal(validate({ ...validInteractionPayload(), context: 3 }), false);
        assert.equal(validate({ ...validInteractionPayload(), authorizing_integration_owners: { "2": "100000000000000003" } }), false);
        assert.equal(validate({ ...validInteractionPayload(), data: {} }), false);
        assert.equal(validate({ ...validInteractionPayload(), entitlements: [{ id: "100000000000000006" }] }), false);
    });
});
