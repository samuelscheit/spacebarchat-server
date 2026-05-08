import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, unknown>;
const interactionMessageSchema = schemas.InteractionMessage as Record<string, unknown>;
const interactionMessageSchemaWithDefinitions = {
    ...interactionMessageSchema,
    definitions: schemas,
};

function compileInteractionMessageSchema() {
    return new Ajv({ strict: false, validateFormats: false }).compile(interactionMessageSchemaWithDefinitions);
}

function schemaProperty(schema: unknown, property: string) {
    const properties = (schema as { properties?: Record<string, unknown> }).properties;
    assert.ok(properties);

    const value = properties[property];
    assert.notEqual(value, undefined);
    return value;
}

function validInteractionMessage() {
    return {
        content: "message",
        attachments: [
            {
                id: "2",
            },
            {
                id: "0",
                filename: "report.txt",
            },
            {
                id: "1",
                filename: "image.png",
                uploaded_filename: "attachments/100000000000000003/1/image.png",
                original_content_type: "image/png",
            },
            {
                filename: "archive.zip",
                uploaded_filename: "attachments/100000000000000003/2/archive.zip",
            },
        ],
    };
}

function uploadReservationAttachment() {
    return {
        files: [
            {
                id: "0",
                filename: "reservation.txt",
                file_size: 1,
            },
        ],
    };
}

describe("InteractionMessage", () => {
    test("reuses the message create attachment and poll schemas", () => {
        assert.deepEqual(schemaProperty(interactionMessageSchema, "attachments"), schemaProperty(schemas.MessageCreateSchema, "attachments"));
        assert.deepEqual(schemaProperty(interactionMessageSchema, "poll"), schemaProperty(schemas.MessageCreateSchema, "poll"));
    });

    test("accepts message attachment descriptors", () => {
        const validate = compileInteractionMessageSchema();

        assert.equal(validate(validInteractionMessage()), true, JSON.stringify(validate.errors));
    });

    test("rejects unconstrained and upload reservation attachments", () => {
        const validate = compileInteractionMessageSchema();

        assert.equal(validate({ ...validInteractionMessage(), attachments: ["not-an-attachment"] }), false);
        assert.equal(validate({ ...validInteractionMessage(), attachments: [{}] }), false);
        assert.equal(validate({ ...validInteractionMessage(), attachments: [uploadReservationAttachment()] }), false);
    });
});
