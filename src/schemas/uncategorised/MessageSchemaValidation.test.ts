import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";

type JsonSchema = Record<string, unknown>;

function compileSchema(name: string, propertyNames: string[]) {
    const schemas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets/schemas.json"), "utf8")) as Record<string, JsonSchema>;
    const schema = schemas[name];
    const properties = schema.properties as Record<string, JsonSchema>;
    const ajv = new Ajv({ strict: false, allErrors: true });

    const focusedSchema: JsonSchema = {
        type: "object",
        additionalProperties: schema.additionalProperties,
        properties: Object.fromEntries(propertyNames.filter((property) => properties[property]).map((property) => [property, properties[property]])),
        definitions: schemas,
    };

    for (const requiredKey of ["type", "required"]) {
        if (schema[requiredKey]) focusedSchema[requiredKey] = schema[requiredKey];
    }

    return ajv.compile(focusedSchema);
}

describe("message schema validation", () => {
    test("create accepts Discord multipart attachment metadata with id-only attachments", () => {
        const validate = compileSchema("MessageCreateSchema", ["content", "attachments"]);

        assert.equal(validate({ content: "hello", attachments: [{ id: "0" }] }), true, JSON.stringify(validate.errors));
    });

    test("create rejects top-level files metadata that attempts to use cloud upload filenames", () => {
        const validate = compileSchema("MessageCreateSchema", ["content", "files"]);

        assert.equal(
            validate({ content: "hello", files: [{ id: "0", uploaded_filename: "channel/upload/cloud.png" }] }),
            false,
            "files[].uploaded_filename must not be accepted as upload metadata",
        );
    });

    test("edit rejects create-only upload fields", () => {
        const validate = compileSchema("MessageEditSchema", ["content"]);

        assert.equal(validate({ content: "hello", files: [{ id: "0", filename: "ignored.png" }] }), false, "files must be rejected on message edit");
        assert.equal(validate({ payload_json: '{"content":"hello"}' }), false, "payload_json must be rejected on message edit");
    });

    test("create rejects client-supplied poll answer ids", () => {
        const validate = compileSchema("MessageCreateSchema", ["poll"]);

        assert.equal(
            validate({
                poll: {
                    question: { text: "Deploy?" },
                    answers: [{ poll_media: { text: "Yes" } }],
                },
            }),
            true,
            JSON.stringify(validate.errors),
        );
        assert.equal(
            validate({
                poll: {
                    question: { text: "Deploy?" },
                    answers: [{ answer_id: 1, poll_media: { text: "Yes" } }],
                },
            }),
            false,
            "answer_id must be server-owned and rejected in create payloads",
        );
    });
});
