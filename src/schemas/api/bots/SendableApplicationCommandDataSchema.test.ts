import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemas = JSON.parse(readFileSync(join(process.cwd(), "assets", "schemas.json"), "utf8")) as Record<string, unknown>;
const commandDataSchema = {
    ...(schemas.SendableApplicationCommandDataSchema as Record<string, unknown>),
    definitions: schemas,
};

function compileCommandDataSchema() {
    return new Ajv({ strict: false, validateFormats: false }).compile(commandDataSchema);
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
                        id: "wrong-shape",
                        filename: "reservation.txt",
                        file_size: 1,
                    },
                ],
            },
        ],
    };
}

function validCommandData() {
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
        ],
    };
}

describe("SendableApplicationCommandDataSchema", () => {
    test("accepts typed message attachment descriptors", () => {
        const validate = compileCommandDataSchema();

        assert.equal(validate(validCommandData()), true, JSON.stringify(validate.errors));
    });

    test("rejects untyped attachment objects", () => {
        const validate = compileCommandDataSchema();

        assert.equal(validate({ ...validCommandData(), attachments: [{}] }), false);
        assert.equal(validate(uploadReservationCommandData()), false);
    });
});
