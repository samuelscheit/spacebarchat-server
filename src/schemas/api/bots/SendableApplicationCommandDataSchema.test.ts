import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, unknown>;
const sendableApplicationCommandDataSchema = schemas.SendableApplicationCommandDataSchema as Record<string, unknown>;
const commandDataSchema = {
    ...sendableApplicationCommandDataSchema,
    definitions: schemas,
};

function compileCommandDataSchema() {
    return new Ajv({ strict: false, validateFormats: false }).compile(commandDataSchema);
}

function schemaProperty(schema: unknown, property: string) {
    const properties = (schema as { properties?: Record<string, unknown> }).properties;
    assert.ok(properties);

    const value = properties[property];
    assert.notEqual(value, undefined);
    return value;
}

function uploadReservationCommandData() {
    return {
        id: "100000000000000001",
        name: "upload",
        version: "100000000000000002",
        attachments: [
            {
                files: [
                    {
                        id: "0",
                        filename: "reservation.txt",
                        file_size: 1,
                    },
                ],
            },
            {
                files: [
                    {
                        filename: "image.png",
                        file_size: 4096,
                        is_clip: false,
                        original_content_type: "image/png",
                    },
                ],
            },
        ],
    };
}

function messageDescriptorCommandData() {
    return {
        id: "100000000000000001",
        name: "upload",
        version: "100000000000000002",
        attachments: [
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

describe("SendableApplicationCommandDataSchema", () => {
    test("uses the upload attachment reservation schema", () => {
        assert.deepEqual(schemaProperty(sendableApplicationCommandDataSchema, "attachments"), {
            type: "array",
            items: {
                $ref: "#/definitions/UploadAttachmentRequestSchema",
            },
        });
    });

    test("accepts upload attachment reservations", () => {
        const validate = compileCommandDataSchema();

        assert.equal(validate(uploadReservationCommandData()), true, JSON.stringify(validate.errors));
    });

    test("rejects arbitrary attachment objects and message descriptors", () => {
        const validate = compileCommandDataSchema();

        assert.equal(validate({ ...uploadReservationCommandData(), attachments: [{}] }), false);
        assert.equal(validate(messageDescriptorCommandData()), false);
        assert.equal(validate({ ...uploadReservationCommandData(), attachments: [{ files: [{ filename: "missing-size.txt" }] }] }), false);
        assert.equal(
            validate({ ...uploadReservationCommandData(), attachments: [{ files: [{ filename: "extra.txt", file_size: 1, uploaded_filename: "cloud/path.txt" }] }] }),
            false,
        );
        assert.equal(validate({ ...uploadReservationCommandData(), attachments: [{ files: [{ filename: "extra.txt", file_size: 1 }], unexpected: true }] }), false);
    });
});
